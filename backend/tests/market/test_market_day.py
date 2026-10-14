import datetime as dt

from market_helpers import FROZEN_NOW, call, daily_frame, fixture_text, market_item
from mktdata import events, fred
from mktdata.errors import UpstreamError

FF_THIS = events.FF_URLS["thisweek"]
TODAY = "2026-10-13"
PAST = "2026-08-05"  # outside FF's two weeks → FMP


def _prices(world, day: str):
    if day == TODAY:
        es = {"2026-10-09": 6700.0, "2026-10-12": 6710.0, "2026-10-13": 6738.18}
        nq = {"2026-10-12": 25000.0, "2026-10-13": 24725.0}
        vix = {"2026-10-12": 17.0, "2026-10-13": 18.2}
    else:
        es = {"2026-08-04": 6400.0, "2026-08-05": 6368.0}
        nq = {"2026-08-04": 23000.0, "2026-08-05": 23115.0}
        vix = {"2026-08-04": 17.05, "2026-08-05": 19.35}
    world.yf.registry[("ES=F", "1d")] = daily_frame(es)
    world.yf.registry[("NQ=F", "1d")] = daily_frame(nq)
    world.yf.registry[("^VIX", "1d")] = daily_frame(vix)


def _fmp(world, status=200):
    world.http.routes[events.FMP_URL] = (status, fixture_text("fmp_calendar.json"))


def test_today_full_shape_and_30min_ttl(world):
    _prices(world, TODAY)
    world.http.routes[FF_THIS] = (200, fixture_text("ff_thisweek.json"))
    status, body = call(f"/api/market/day/{TODAY}")
    assert status == 200
    assert body["date"] == TODAY
    assert body["indices"] == {
        "ES": {"close": 6738.18, "changePct": 0.42},
        "NQ": {"close": 24725.0, "changePct": -1.1},
    }
    assert body["vix"] == {"close": 18.2, "change": 1.2}
    assert [e["title"] for e in body["events"]][:2] == ["CPI m/m", "Core CPI m/m"]
    assert body["sources"] == {"indices": "yahoo", "vix": "yahoo", "events": "forexfactory"}
    item = market_item(f"DAY#{TODAY}")
    assert int(item["ttl"]) == int(FROZEN_NOW.timestamp()) + 1800


def test_past_complete_day_cached_forever_and_served_from_cache(world):
    _prices(world, PAST)
    _fmp(world)
    status, body = call(f"/api/market/day/{PAST}")
    assert status == 200 and body["sources"] == {"indices": "yahoo", "vix": "yahoo", "events": "fmp"}
    assert body["indices"]["ES"] == {"close": 6368.0, "changePct": -0.5}
    assert [e["time"] for e in body["events"]] == ["08:30", "10:00", "22:00"]
    assert "ttl" not in market_item(f"DAY#{PAST}")

    n_yf, n_http = len(world.yf.calls), len(world.http.calls)
    world.set_now(FROZEN_NOW + dt.timedelta(days=30))
    status, again = call(
        f"/api/market/day/{PAST}", sub="22222222-bbbb-4bbb-8bbb-222222222222"
    )  # shared across users
    assert status == 200 and again == body
    assert (len(world.yf.calls), len(world.http.calls)) == (n_yf, n_http)


def test_expired_ttl_row_is_a_miss(world):
    _prices(world, TODAY)
    world.http.routes[FF_THIS] = (200, "[]")
    call(f"/api/market/day/{TODAY}")
    n = len(world.yf.calls)
    world.set_now(FROZEN_NOW + dt.timedelta(minutes=10))
    call(f"/api/market/day/{TODAY}")
    assert len(world.yf.calls) == n  # still fresh
    world.set_now(FROZEN_NOW + dt.timedelta(minutes=31))
    call(f"/api/market/day/{TODAY}")
    assert len(world.yf.calls) == n + 3  # ES, NQ, VIX refetched


def test_one_index_failing_nulls_only_that_index(world):
    _prices(world, PAST)
    world.yf.registry[("ES=F", "1d")] = RuntimeError("yahoo down")
    _fmp(world)
    status, body = call(f"/api/market/day/{PAST}")
    assert status == 200
    assert body["indices"]["ES"] is None and body["indices"]["NQ"]["close"] == 23115.0
    assert body["sources"]["indices"] == "partial"
    assert int(market_item(f"DAY#{PAST}")["ttl"]) == int(FROZEN_NOW.timestamp()) + 1800  # not forever


def test_vix_falls_back_to_fred(world):
    _prices(world, PAST)
    world.yf.registry[("^VIX", "1d")] = RuntimeError("yahoo down")
    world.http.routes[fred.URL] = (200, fixture_text("fred_vixcls.csv"))
    _fmp(world)
    status, body = call(f"/api/market/day/{PAST}")
    assert status == 200
    assert body["vix"] == {"close": 19.35, "change": 2.3}
    assert body["sources"]["vix"] == "fred"
    assert "ttl" not in market_item(f"DAY#{PAST}")  # FRED counts as present


def test_everything_failing_still_200_with_empty_sections(world):
    for sym in ("ES=F", "NQ=F", "^VIX"):
        world.yf.registry[(sym, "1d")] = RuntimeError("down")
    world.http.routes[fred.URL] = (500, "down")
    world.http.routes[FF_THIS] = (503, "down")
    world.http.routes[events.FMP_URL] = (500, "down")
    status, body = call(f"/api/market/day/{TODAY}")
    assert status == 200
    assert body == {
        "date": TODAY,
        "indices": {"ES": None, "NQ": None},
        "vix": None,
        "events": [],
        "sources": {"indices": "error", "vix": "error", "events": "error"},
    }


def test_fmp_402_marks_events_unavailable_and_caches_a_day(world):
    _prices(world, PAST)
    _fmp(world, status=402)
    status, body = call(f"/api/market/day/{PAST}")
    assert status == 200 and body["events"] == [] and body["sources"]["events"] == "unavailable"
    assert body["indices"]["ES"] is not None
    assert int(market_item(f"DAY#{PAST}")["ttl"]) == int(FROZEN_NOW.timestamp()) + 24 * 3600


def test_weekend_is_closed_not_an_error(world):
    _prices(world, PAST)  # no rows for Saturday 2026-08-08
    _fmp(world)
    status, body = call("/api/market/day/2026-08-08")
    assert status == 200 and body["indices"] == {"ES": None, "NQ": None}
    assert body["sources"]["indices"] == "yahoo"


def test_future_day_skips_prices(world):
    world.http.routes[events.FF_URLS["nextweek"]] = (200, "[]")
    status, body = call("/api/market/day/2026-10-20")
    assert status == 200 and body["sources"]["indices"] == "none" and body["vix"] is None
    assert world.yf.calls == []


def test_validation_and_auth(world):
    assert call("/api/market/day/2026-13-01")[0] == 400
    assert call("/api/market/day/20261013")[0] == 400
    assert call("/api/market/day/1999-12-31")[0] == 400
    assert call("/api/market/day/2027-01-01")[0] == 400
    assert call(f"/api/market/day/{TODAY}", sub=None)[0] == 401


def test_daily_frame_conversion_skips_nan(world):
    from mktdata import yahoo

    world.yf.registry[("ES=F", "1d")] = daily_frame({"2026-10-12": float("nan"), "2026-10-13": 1.0})
    assert yahoo.daily_closes("ES=F", dt.date(2026, 10, 1), dt.date(2026, 10, 14)) == [("2026-10-13", 1.0)]
    world.yf.registry[("ES=F", "1d")] = daily_frame({})
    try:
        yahoo.daily_closes("ES=F", dt.date(2026, 10, 1), dt.date(2026, 10, 14))
        raise AssertionError("expected UpstreamError")
    except UpstreamError:
        pass
