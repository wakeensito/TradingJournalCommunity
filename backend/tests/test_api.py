"""Every route in the spec's API table: happy paths, ownership isolation, validation, sk moves."""

from __future__ import annotations

import os
from urllib.parse import urlparse

import boto3
import pytest
from helpers import USER_A, USER_B, call, items, trade


def _sks(sub=USER_A):
    return sorted(i["sk"] for i in items(sub))


# ── health / auth ───────────────────────────────────────────────────────
def test_health_needs_no_auth(aws):
    assert call("GET", "/api/health", sub=None) == (200, {"ok": True})


def test_missing_claims_is_401(aws):
    status, body = call("GET", "/api/bootstrap", sub=None)
    assert status == 401 and "error" in body


def test_unknown_route_is_404(aws):
    status, body = call("GET", "/api/nope")
    assert status == 404 and body == {"error": "Not found"}


# ── bootstrap ───────────────────────────────────────────────────────────
def test_bootstrap_empty_returns_default_settings(aws):
    status, body = call("GET", "/api/bootstrap")
    assert status == 200
    assert body["trades"] == [] and body["accounts"] == [] and body["days"] == []
    assert body["settings"]["feesPerContract"]["MNQ"] == 1.24
    assert body["settings"]["recentSymbols"] == ["MNQ", "MES"]
    assert body["settings"]["defaultAccountId"] is None


def test_bootstrap_returns_everything_and_strips_keys(aws):
    call("PUT", "/api/trades/t1", trade("t1"))
    call("PUT", "/api/accounts/a1", {"id": "a1", "name": "Apex", "type": "prop-eval", "startBalance": 50000})
    call("PUT", "/api/days/2026-10-13", {"date": "2026-10-13", "review": {"text": "ok"}})
    call("PUT", "/api/settings", {"breakevenBand": 5})
    status, body = call("GET", "/api/bootstrap")
    assert status == 200
    assert [t["id"] for t in body["trades"]] == ["t1"]
    assert set(body["trades"][0]) & {"pk", "sk", "tid"} == set()
    assert body["trades"][0]["qty"] == 2 and body["trades"][0]["entry"] == 21000.25
    assert [a["id"] for a in body["accounts"]] == ["a1"]
    assert [d["date"] for d in body["days"]] == ["2026-10-13"]
    assert body["settings"]["breakevenBand"] == 5
    assert body["settings"]["setups"][0] == "Breakout"  # defaults fill the rest


def test_bootstrap_paginates(aws, monkeypatch):
    import app as api

    real_query = api.table().query

    def small_pages(**kw):
        return real_query(Limit=2, **kw)

    monkeypatch.setattr(api.table(), "query", small_pages)
    for i in range(5):
        api.table().put_item(Item={"pk": f"USER#{USER_A}", "sk": f"DAY#2026-10-0{i + 1}", "date": "x"})
    status, body = call("GET", "/api/bootstrap")
    assert status == 200 and len(body["days"]) == 5


# ── trades ──────────────────────────────────────────────────────────────
def test_put_trade_creates_and_server_sets_timestamps(aws):
    status, body = call("PUT", "/api/trades/t1", trade("t1", junk="drop me"))
    assert status == 200
    assert "junk" not in body
    assert body["createdAt"] == "2026-10-13T13:31:00.000Z"
    assert body["updatedAt"] != "2026-10-13T13:31:00.000Z"
    assert _sks() == ["TRADE#2026-10-13#t1"]
    item = items()[0]
    assert item["tid"] == "t1" and "junk" not in item


def test_put_trade_keeps_existing_created_at(aws):
    call("PUT", "/api/trades/t1", trade("t1"))
    status, body = call("PUT", "/api/trades/t1", trade("t1", createdAt="2030-01-01T00:00:00Z", notes="x"))
    assert status == 200
    assert body["createdAt"] == "2026-10-13T13:31:00.000Z"
    assert body["notes"] == "x"


def test_put_trade_date_change_moves_sort_key(aws):
    call("PUT", "/api/trades/t1", trade("t1"))
    status, body = call("PUT", "/api/trades/t1", trade("t1", date="2026-10-10"))
    assert status == 200 and body["date"] == "2026-10-10"
    assert _sks() == ["TRADE#2026-10-10#t1"]
    assert body["createdAt"] == "2026-10-13T13:31:00.000Z"


def test_put_trade_body_id_mismatch_rejected(aws):
    status, body = call("PUT", "/api/trades/t1", trade("t2"))
    assert status == 400 and "id" in body["error"]


@pytest.mark.parametrize(
    "override, fragment",
    [
        ({"qty": 0}, "qty"),
        ({"qty": -1}, "qty"),
        ({"qty": "abc"}, "qty"),
        ({"qty": True}, "qty"),
        ({"side": "up"}, "side"),
        ({"assetType": "crypto"}, "assetType"),
        ({"source": "ibkr"}, "source"),
        ({"date": "10/13/2026"}, "date"),
        ({"date": "2026-02-30"}, "date"),
        ({"time": "9:31"}, "time"),
        ({"time": "24:00"}, "time"),
        ({"symbol": "x" * 201}, "symbol"),
        ({"symbol": ""}, "symbol"),
        ({"notes": "n" * 5001}, "notes"),
        ({"fees": -1}, "fees"),
        ({"multiplier": 0}, "multiplier"),
        ({"mood": 6}, "mood"),
        ({"photoKeys": [f"users/{USER_A}/trades/t1/{i}.jpg" for i in range(7)]}, "photos"),
        ({"photoKeys": [f"users/{USER_B}/trades/t1/x.jpg"]}, "photo"),
        ({"photoKeys": [f"users/{USER_A}/../{USER_B}/x.jpg"]}, "photo"),
        ({"option": {"underlying": "SPY", "right": "X", "strike": 500, "expiry": "2026-12-19"}}, "right"),
    ],
)
def test_put_trade_validation(aws, override, fragment):
    status, body = call("PUT", "/api/trades/t1", trade("t1", **override))
    assert status == 400, body
    assert fragment in body["error"]
    assert items() == []


def test_put_trade_invalid_id_and_bad_json(aws):
    status, _ = call("PUT", "/api/trades/bad%23id", trade("bad#id"))
    assert status == 400
    assert call("PUT", "/api/trades/t1", "{not json")[0] == 400
    assert call("PUT", "/api/trades/t1", [1, 2])[0] == 400


def test_put_trade_coerces_numeric_strings_and_accepts_options(aws):
    status, body = call(
        "PUT",
        "/api/trades/o1",
        trade(
            "o1",
            symbol="SPY 500C 12/19",
            assetType="option",
            qty="3",
            entry="1.25",
            exit="2.5",
            multiplier=100,
            option={"underlying": "SPY", "right": "C", "strike": 500, "expiry": "2026-12-19"},
            mistakes=["FOMO entry"],
            photoKeys=[f"users/{USER_A}/trades/o1/a.jpg"],
            mood=4,
            stop=1.0,
            setup=None,
        ),
    )
    assert status == 200, body
    assert body["qty"] == 3 and body["entry"] == 1.25 and body["exit"] == 2.5
    assert body["option"]["strike"] == 500
    assert "setup" not in body


def test_delete_trade_removes_item_and_photos(aws):
    s3 = boto3.client("s3")
    bucket = os.environ["PHOTO_BUCKET"]
    key = f"users/{USER_A}/trades/t1/p.jpg"
    s3.put_object(Bucket=bucket, Key=key, Body=b"img")
    call("PUT", "/api/trades/t1", trade("t1", photoKeys=[key]))
    status, body = call("DELETE", "/api/trades/t1")
    assert (status, body) == (200, {"deleted": True})
    assert items() == []
    assert s3.list_objects_v2(Bucket=bucket).get("KeyCount") == 0


def test_delete_missing_trade_is_idempotent(aws):
    assert call("DELETE", "/api/trades/nope") == (200, {"deleted": True})
    assert call("DELETE", "/api/trades/bad#id")[0] in (400, 404)


# ── batch ───────────────────────────────────────────────────────────────
def test_batch_writes_and_is_idempotent(aws):
    batch = {"trades": [trade("t1"), trade("t2"), trade("t1", notes="dup")]}
    assert call("POST", "/api/trades/batch", batch) == (200, {"written": 2})
    assert call("POST", "/api/trades/batch", batch) == (200, {"written": 2})
    assert _sks() == ["TRADE#2026-10-13#t1", "TRADE#2026-10-13#t2"]


def test_batch_moves_date_and_keeps_created_at(aws):
    call("POST", "/api/trades/batch", {"trades": [trade("t1")]})
    call("POST", "/api/trades/batch", {"trades": [trade("t1", date="2026-10-01", createdAt=None)]})
    assert _sks() == ["TRADE#2026-10-01#t1"]
    assert items()[0]["createdAt"] == "2026-10-13T13:31:00.000Z"


def test_batch_limits_and_validation(aws):
    status, body = call("POST", "/api/trades/batch", {"trades": [trade(f"t{i}") for i in range(501)]})
    assert status == 400 and "500" in body["error"]
    status, body = call("POST", "/api/trades/batch", {"trades": [trade("t1"), trade("t2", qty=0)]})
    assert status == 400 and body["error"].startswith("trades[1]")
    assert items() == []  # all-or-nothing validation
    assert call("POST", "/api/trades/batch", {"trades": "x"})[0] == 400


# ── combine ─────────────────────────────────────────────────────────────
def test_combine_puts_merged_and_deletes_sources(aws):
    for i in (1, 2, 3):
        call("PUT", f"/api/trades/t{i}", trade(f"t{i}", qty=1))
    merged = trade("m1", qty=3)
    status, body = call("POST", "/api/trades/combine", {"sourceIds": ["t1", "t2", "t3"], "merged": merged})
    assert status == 200 and body["id"] == "m1" and body["qty"] == 3
    assert _sks() == ["TRADE#2026-10-13#m1"]


def test_combine_can_reuse_a_source_id(aws):
    call("PUT", "/api/trades/t1", trade("t1", qty=1))
    call("PUT", "/api/trades/t2", trade("t2", qty=1, date="2026-10-12"))
    status, _ = call("POST", "/api/trades/combine", {"sourceIds": ["t1", "t2"], "merged": trade("t1", qty=2)})
    assert status == 200
    assert _sks() == ["TRADE#2026-10-13#t1"]
    assert items()[0]["qty"] == 2


def test_combine_missing_source_is_404_and_changes_nothing(aws):
    call("PUT", "/api/trades/t1", trade("t1"))
    status, _ = call("POST", "/api/trades/combine", {"sourceIds": ["t1", "ghost"], "merged": trade("m1")})
    assert status == 404
    assert _sks() == ["TRADE#2026-10-13#t1"]


def test_combine_limits(aws):
    ids = [f"t{i}" for i in range(100)]
    assert call("POST", "/api/trades/combine", {"sourceIds": ids, "merged": trade("m")})[0] == 400
    assert call("POST", "/api/trades/combine", {"sourceIds": [], "merged": trade("m")})[0] == 400


# ── days / accounts / settings ──────────────────────────────────────────
def test_put_day(aws):
    note = {
        "date": "2026-10-13",
        "plan": {"bias": "long", "levels": "21000 / 21100", "focus": "wait for pullback"},
        "review": {"text": "Followed the plan.", "followedPlan": True, "mood": 4},
        "extra": 1,
    }
    status, body = call("PUT", "/api/days/2026-10-13", note)
    assert status == 200
    assert body["review"]["followedPlan"] is True and "extra" not in body and body["updatedAt"]
    assert _sks() == ["DAY#2026-10-13"]


@pytest.mark.parametrize(
    "path, payload",
    [
        ("/api/days/2026-13-01", {"date": "2026-13-01"}),
        ("/api/days/2026-10-13", {"date": "2026-10-12"}),
        ("/api/days/2026-10-13", {"plan": {"bias": "up"}}),
        ("/api/days/2026-10-13", {"review": {"followedPlan": "yes"}}),
        ("/api/days/2026-10-13", {"review": {"text": "x" * 5001}}),
    ],
)
def test_put_day_validation(aws, path, payload):
    assert call("PUT", path, payload)[0] == 400


def test_accounts_put_and_delete(aws):
    acct = {
        "id": "a1",
        "name": "Apex 50K #2",
        "type": "prop-eval",
        "startBalance": 50000,
        "profitTarget": 3000,
        "maxDrawdown": 2500,
        "drawdownType": "trailing",
        "dailyLossLimit": 1000,
        "status": "active",
    }
    status, body = call("PUT", "/api/accounts/a1", acct)
    assert status == 200 and body["profitTarget"] == 3000 and body["createdAt"]
    created = body["createdAt"]
    status, body = call("PUT", "/api/accounts/a1", {**acct, "status": "passed"})
    assert body["status"] == "passed" and body["createdAt"] == created
    assert call("DELETE", "/api/accounts/a1") == (200, {"deleted": True})
    assert call("DELETE", "/api/accounts/a1") == (200, {"deleted": True})  # idempotent
    assert items() == []


def test_account_validation(aws):
    assert call("PUT", "/api/accounts/a1", {"name": "x", "type": "cash", "startBalance": 1})[0] == 400
    assert call("PUT", "/api/accounts/a1", {"name": "x", "type": "personal"})[0] == 400


def test_settings_merge_and_validate(aws):
    status, body = call("PUT", "/api/settings", {"feesPerContract": {"default": 1, "MNQ": 0.5}, "bogus": 1})
    assert status == 200
    assert body["feesPerContract"] == {"default": 1, "MNQ": 0.5}
    assert body["setups"][0] == "Breakout" and "bogus" not in body
    status, body = call("PUT", "/api/settings", {"recentSymbols": [f"S{i}" for i in range(12)]})
    assert len(body["recentSymbols"]) == 8 and body["feesPerContract"]["MNQ"] == 0.5
    assert call("PUT", "/api/settings", {"breakevenBand": -1})[0] == 400
    assert call("PUT", "/api/settings", {"setups": ["x" * 201]})[0] == 400


# ── photos ──────────────────────────────────────────────────────────────
def test_upload_url_key_prefix_and_content_type(aws):
    status, body = call(
        "POST", "/api/photos/upload-url", {"tradeId": "t1", "contentType": "image/png", "size": 1000}
    )
    assert status == 200
    assert body["key"].startswith(f"users/{USER_A}/trades/t1/") and body["key"].endswith(".png")
    url = urlparse(body["url"])
    assert url.hostname == f"{os.environ['PHOTO_BUCKET']}.s3.us-east-1.amazonaws.com"
    assert "content-type" in url.query.lower() or "X-Amz-SignedHeaders" in url.query
    assert "X-Amz-Expires=300" in url.query


def test_upload_url_rejects_bad_input(aws):
    assert call("POST", "/api/photos/upload-url", {"tradeId": "t1", "contentType": "image/gif"})[0] == 400
    # size is mandatory — without it the 8 MB cap could be bypassed
    assert call("POST", "/api/photos/upload-url", {"tradeId": "t1", "contentType": "image/png"})[0] == 400
    assert call("POST", "/api/photos/upload-url", {"tradeId": "../x", "contentType": "image/png"})[0] == 400
    big = {"tradeId": "t1", "contentType": "image/jpeg", "size": 9 * 1024 * 1024}
    assert call("POST", "/api/photos/upload-url", big)[0] == 400


def test_view_urls(aws):
    keys = [f"users/{USER_A}/trades/t1/a.jpg", f"users/{USER_A}/trades/t1/b.webp"]
    status, body = call("POST", "/api/photos/view-urls", {"keys": keys})
    assert status == 200 and set(body["urls"]) == set(keys)
    assert all("X-Amz-Expires=3600" in u for u in body["urls"].values())


def test_view_urls_limits(aws):
    keys = [f"users/{USER_A}/k{i}.jpg" for i in range(101)]
    assert call("POST", "/api/photos/view-urls", {"keys": keys})[0] == 400


# ── ownership isolation ─────────────────────────────────────────────────
def test_user_b_cannot_see_or_touch_user_a_data(aws):
    call("PUT", "/api/trades/t1", trade("t1"))
    call("PUT", "/api/accounts/a1", {"name": "Mine", "type": "personal", "startBalance": 1})

    status, body = call("GET", "/api/bootstrap", sub=USER_B)
    assert status == 200 and body["trades"] == [] and body["accounts"] == []

    # B's deletes only ever address B's partition: no-ops here, A's data untouched (asserted below).
    call("DELETE", "/api/trades/t1", sub=USER_B)
    call("DELETE", "/api/accounts/a1", sub=USER_B)
    combine = {"sourceIds": ["t1"], "merged": trade("m1")}
    assert call("POST", "/api/trades/combine", combine, sub=USER_B)[0] == 404

    # B writing the same id lands in B's partition only.
    call("PUT", "/api/trades/t1", trade("t1", qty=9), sub=USER_B)
    (a_trade,) = [i for i in items(USER_A) if i["sk"].startswith("TRADE#")]
    assert a_trade["qty"] == 2 and len(items(USER_B)) == 1

    assert _sks(USER_A) == ["ACCOUNT#a1", "TRADE#2026-10-13#t1"]


def test_user_b_cannot_get_urls_for_user_a_photos(aws):
    key = f"users/{USER_A}/trades/t1/a.jpg"
    status, body = call("POST", "/api/photos/view-urls", {"keys": [key]}, sub=USER_B)
    assert status == 400 and "error" in body
    status, _ = call("PUT", "/api/trades/t9", trade("t9", photoKeys=[key]), sub=USER_B)
    assert status == 400
