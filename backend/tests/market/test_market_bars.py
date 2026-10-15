import datetime as dt
import json

from market_helpers import FROZEN_NOW, NY, FakeFrame, call, intraday_frame, market_item
from mktdata import cache

TODAY = dt.date(2026, 10, 13)


def _q(symbol="MNQZ5", date="2026-10-12", asset="futures", **kw):
    return {"symbol": symbol, "date": date, "assetType": asset, **kw}


def test_one_minute_bars_for_recent_day_cached_forever(world):
    day = dt.date(2026, 10, 12)
    world.yf.registry[("MNQ=F", "1m")] = intraday_frame(day, "09:30", 390, 1)
    status, body = call("/api/market/bars", _q())
    assert status == 200
    assert body["symbol"] == "MNQ=F" and body["interval"] == "1m" and body["tz"] == "America/New_York"
    assert len(body["bars"]) == 390
    first = body["bars"][0]
    assert first == {
        "t": int(dt.datetime(2026, 10, 12, 13, 30, tzinfo=dt.UTC).timestamp()),
        "o": 100.0,
        "h": 100.5,
        "l": 99.5,
        "c": 100.25,
        "v": 100,
    }
    sym, kw = world.yf.calls[0]
    assert kw["prepost"] is True and kw["interval"] == "1m"
    assert kw["start"].isoformat() == "2026-10-12T00:00:00-04:00"
    item = market_item("BARS#MNQ=F#2026-10-12#1m")
    assert "ttl" not in item
    assert len(item["data"]) < cache.MAX_DATA_BYTES

    n = len(world.yf.calls)
    assert call("/api/market/bars", _q())[1] == body
    assert len(world.yf.calls) == n


def test_five_minute_bars_between_7_and_60_days(world):
    day = TODAY - dt.timedelta(days=30)
    world.yf.registry[("SPY", "5m")] = intraday_frame(day, "04:00", 192, 5)
    status, body = call("/api/market/bars", _q("SPY 500C 12/19", day.isoformat(), "option", underlying="SPY"))
    assert status == 200 and body["interval"] == "5m" and body["symbol"] == "SPY"


def test_older_than_60_days_is_404_with_message(world):
    status, body = call("/api/market/bars", _q(date=(TODAY - dt.timedelta(days=60)).isoformat()))
    assert status == 404 and body == {"error": "Intraday bars older than 60 days aren't available"}
    assert world.yf.calls == []


def test_micro_empty_falls_back_to_full_size(world):
    day = dt.date(2026, 10, 12)
    world.yf.registry[("MES=F", "1m")] = FakeFrame([])
    world.yf.registry[("ES=F", "1m")] = intraday_frame(day, "09:30", 10, 1)
    status, body = call("/api/market/bars", _q("MESZ5"))
    assert status == 200 and body["symbol"] == "ES=F"
    assert [c[0] for c in world.yf.calls] == ["MES=F", "ES=F"]
    assert market_item("BARS#ES=F#2026-10-12#1m") is not None


def test_micro_error_falls_back_too(world):
    day = dt.date(2026, 10, 12)
    world.yf.registry[("MNQ=F", "1m")] = RuntimeError("rate limited")
    world.yf.registry[("NQ=F", "1m")] = intraday_frame(day, "09:30", 5, 1)
    status, body = call("/api/market/bars", _q())
    assert status == 200 and body["symbol"] == "NQ=F"


def test_today_bars_short_ttl(world):
    world.yf.registry[("AAPL", "1m")] = intraday_frame(TODAY, "09:30", 60, 1)
    status, _ = call("/api/market/bars", _q("AAPL", TODAY.isoformat(), "stock"))
    assert status == 200
    assert int(market_item("BARS#AAPL#2026-10-13#1m")["ttl"]) == int(FROZEN_NOW.timestamp()) + 60


def test_bars_outside_the_et_day_are_dropped(world):
    day = dt.date(2026, 10, 12)
    world.yf.registry[("AAPL", "1m")] = intraday_frame(day, "23:58", 4, 1)  # 23:58, 23:59, 00:00+1, 00:01+1
    status, body = call("/api/market/bars", _q("AAPL", day.isoformat(), "stock"))
    assert status == 200 and len(body["bars"]) == 2


def test_past_day_without_bars_is_market_closed_and_all_errors_502(world):
    status, body = call("/api/market/bars", _q("AAPL", "2026-10-11", "stock"))  # Sunday: empty
    assert status == 200 and body["bars"] == [] and body["reason"] == "market-closed"
    assert "pending" not in body
    assert market_item("BARS#AAPL#2026-10-11#1m") is None
    world.yf.registry[("MNQ=F", "1m")] = RuntimeError("x")
    world.yf.registry[("NQ=F", "1m")] = RuntimeError("x")
    assert call("/api/market/bars", _q())[0] == 502


# ── Yahoo lag: today's bars arrive 5–15 min late ───────────────────────
def _at_et(day: dt.date, hhmm: str) -> dt.datetime:
    return dt.datetime.combine(day, dt.time.fromisoformat(hhmm), NY).astimezone(dt.UTC)


def test_today_with_no_bars_yet_is_pending_and_not_cached(world):
    day = dt.date(2026, 10, 15)  # Thursday, just after midnight ET (the owner's bug report)
    world.set_now(_at_et(day, "00:17"))
    status, body = call("/api/market/bars", _q(date=day.isoformat(), **{"from": "00:10", "to": "00:10"}))
    assert status == 200
    assert body["bars"] == [] and body["pending"] is True and body["retryAfterSec"] == 120
    assert body["symbol"] == "MNQ=F" and body["interval"] == "1m"
    assert market_item("BARS#MNQ=F#2026-10-15#1m") is None and market_item("BARS#NQ=F#2026-10-15#1m") is None

    # Minutes later Yahoo catches up: same request now returns bars covering the trade, not pending.
    world.set_now(_at_et(day, "00:21"))
    world.yf.registry[("MNQ=F", "1m")] = intraday_frame(day, "00:09", 9, 1)  # 00:09–00:17
    status, body = call("/api/market/bars", _q(date=day.isoformat(), to="00:10"))
    assert status == 200 and len(body["bars"]) == 9 and "pending" not in body


def test_today_bars_ending_before_the_trade_are_pending(world):
    world.yf.registry[("MNQ=F", "1m")] = intraday_frame(TODAY, "09:30", 60, 1)  # last bar 10:29
    status, body = call("/api/market/bars", _q(date=TODAY.isoformat(), to="14:50"))
    assert status == 200 and len(body["bars"]) == 60 and body["pending"] is True
    # Covered window, or no window given: plain bars.
    assert "pending" not in call("/api/market/bars", _q(date=TODAY.isoformat(), to="10:29"))[1]
    assert "pending" not in call("/api/market/bars", _q(date=TODAY.isoformat()))[1]


def test_yesterday_stays_recent_just_after_midnight(world):
    day = dt.date(2026, 10, 14)
    world.set_now(_at_et(dt.date(2026, 10, 15), "00:10"))
    world.yf.registry[("MNQ=F", "1m")] = intraday_frame(day, "23:00", 50, 1)  # through 23:49
    status, body = call("/api/market/bars", _q(date=day.isoformat(), to="23:58"))
    assert status == 200 and body["pending"] is True
    # Not cached forever while bars may still land.
    assert (
        int(market_item("BARS#MNQ=F#2026-10-14#1m")["ttl"])
        == int(_at_et(dt.date(2026, 10, 15), "00:10").timestamp()) + 60
    )


def test_saturday_today_is_market_closed_not_pending(world):
    day = dt.date(2026, 10, 17)
    world.set_now(_at_et(day, "11:00"))
    status, body = call("/api/market/bars", _q(date=day.isoformat()))
    assert status == 200 and body["reason"] == "market-closed" and "pending" not in body


def test_bad_window_params_are_400(world):
    assert call("/api/market/bars", _q(to="25:00"))[0] == 400
    assert call("/api/market/bars", _q(**{"from": "9:30"}))[0] == 400


def test_validation(world):
    assert call("/api/market/bars", _q("FOOZ5"))[0] == 404
    assert call("/api/market/bars", _q("$$$", asset="stock"))[0] == 400
    assert call("/api/market/bars", _q(asset="crypto"))[0] == 400
    assert call("/api/market/bars", _q(date="2026-10-14"))[0] == 400  # future
    assert call("/api/market/bars", _q(date="nope"))[0] == 400
    assert call("/api/market/bars", {"date": "2026-10-12"})[0] == 400
    assert call("/api/market/bars", _q(), sub=None)[0] == 401


def test_oversized_values_are_not_cached(world):
    assert cache.put("BARS#X#2026-10-12#1m", [[1, 2.0, 3.0, 4.0, 5.0, 6]] * 20000) is False
    assert market_item("BARS#X#2026-10-12#1m") is None
    # a realistic worst case (24h of 1m futures bars) fits comfortably
    rows = [[1760000000 + i * 60, 25012.25, 25013.5, 25011.75, 25012.75, 1234] for i in range(1440)]
    assert len(json.dumps(rows, separators=(",", ":"))) < cache.MAX_DATA_BYTES / 3
