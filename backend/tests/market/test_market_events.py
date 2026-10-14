import datetime as dt
import json

from market_helpers import fixture_text
from mktdata import config, events

FF_THIS = events.FF_URLS["thisweek"]
FF_NEXT = events.FF_URLS["nextweek"]
TODAY = dt.date(2026, 10, 13)  # Tuesday


def test_ff_week_boundaries_sunday_to_saturday():
    assert events.week_start(TODAY) == dt.date(2026, 10, 11)
    assert events.week_start(dt.date(2026, 10, 11)) == dt.date(2026, 10, 11)
    assert events.ff_week_for(dt.date(2026, 10, 11), TODAY) == "thisweek"
    assert events.ff_week_for(dt.date(2026, 10, 17), TODAY) == "thisweek"
    assert events.ff_week_for(dt.date(2026, 10, 18), TODAY) == "nextweek"
    assert events.ff_week_for(dt.date(2026, 10, 24), TODAY) == "nextweek"
    assert events.ff_week_for(dt.date(2026, 10, 25), TODAY) is None
    assert events.ff_week_for(dt.date(2026, 10, 10), TODAY) is None


def test_ff_usd_high_medium_only_converted_to_et():
    rows = json.loads(fixture_text("ff_thisweek.json"))
    got = events.ff_events(rows, TODAY)
    assert got == [
        {"time": "08:30", "title": "CPI m/m", "impact": "high", "forecast": "0.3%", "previous": "0.4%"},
        {"time": "08:30", "title": "Core CPI m/m", "impact": "high", "forecast": "0.3%", "previous": "0.3%"},
        {"time": "14:00", "title": "Federal Budget Balance", "impact": "medium", "forecast": "-25.3B"},
        # 2026-10-14T00:30Z is 20:30 ET on the 13th (EDT, UTC−4)
        {"time": "20:30", "title": "FOMC Member Speaks", "impact": "high"},
    ]


def test_ff_conversion_across_dst_end():
    # 2026-11-02 is the Monday after DST ends (EST, UTC−5): 13:30Z → 08:30 ET.
    rows = [{"title": "X", "country": "USD", "date": "2026-11-02T13:30:00+00:00", "impact": "High"}]
    assert events.ff_events(rows, dt.date(2026, 11, 2))[0]["time"] == "08:30"


def test_fmp_utc_to_et_and_filters():
    rows = json.loads(fixture_text("fmp_calendar.json"))
    got = events.fmp_events(rows, dt.date(2026, 8, 5))
    assert got == [
        {
            "time": "08:30",
            "title": "Trade Balance",
            "impact": "medium",
            "actual": "-66.1",
            "forecast": "-68.2",
            "previous": "-71.5",
        },
        {
            "time": "10:00",
            "title": "ISM Services PMI",
            "impact": "high",
            "forecast": "51.5",
            "previous": "50.8",
        },
        {"time": "22:00", "title": "Late Fed Speech", "impact": "high"},
    ]


def test_for_day_uses_forex_factory_this_week(world):
    world.http.routes[FF_THIS] = (200, fixture_text("ff_thisweek.json"))
    got, source = events.for_day(TODAY, TODAY)
    assert source == "forexfactory" and len(got) == 4
    # feed cached: a second day in the same week doesn't refetch
    got2, _ = events.for_day(dt.date(2026, 10, 15), TODAY)
    assert [e["title"] for e in got2] == ["Retail Sales m/m"]
    assert world.http.urls().count(FF_THIS) == 1


def test_for_day_next_week_uses_nextweek_feed(world):
    world.http.routes[FF_NEXT] = (200, "[]")
    assert events.for_day(dt.date(2026, 10, 20), TODAY) == ([], "forexfactory")


def test_ff_failure_falls_back_to_fmp(world):
    world.http.routes[FF_THIS] = (503, "busy")
    world.http.routes[events.FMP_URL] = (
        200,
        json.dumps(
            [
                {
                    "date": "2026-10-13 12:30:00",
                    "country": "US",
                    "event": "CPI",
                    "impact": "High",
                    "actual": 0.3,
                },
            ]
        ),
    )
    got, source = events.for_day(TODAY, TODAY)
    assert source == "fmp"
    assert got == [{"time": "08:30", "title": "CPI", "impact": "high", "actual": "0.3"}]
    url, params = world.http.calls[-1]
    assert url == events.FMP_URL and params["from"] == "2026-10-13" and params["to"] == "2026-10-14"
    assert params["apikey"] == "test-fmp-key"


def test_fmp_402_is_unavailable_and_memoized(world):
    world.http.routes[events.FMP_URL] = (402, "Restricted Endpoint")
    assert events.for_day(dt.date(2026, 8, 5), TODAY) == ([], "unavailable")
    assert events.for_day(dt.date(2026, 8, 6), TODAY) == ([], "unavailable")
    assert world.http.urls().count(events.FMP_URL) == 1  # second ask skipped: spares the shared key


def test_fmp_error_message_in_200_is_unavailable(world):
    world.http.routes[events.FMP_URL] = (200, json.dumps({"Error Message": "Upgrade your plan"}))
    assert events.for_day(dt.date(2026, 8, 5), TODAY) == ([], "unavailable")


def test_fmp_server_error_is_error_not_unavailable(world):
    world.http.routes[events.FMP_URL] = (500, "oops")
    assert events.for_day(dt.date(2026, 8, 5), TODAY) == ([], "error")


def test_missing_ssm_key_is_unavailable(world, monkeypatch):
    monkeypatch.setenv("FMP_KEY_PARAM", "no-such-param")
    config.reset()
    assert events.for_day(dt.date(2026, 8, 5), TODAY) == ([], "unavailable")
    assert events.FMP_URL not in world.http.urls()


def test_key_fetched_once_per_container(world, monkeypatch):
    world.http.routes[events.FMP_URL] = (200, "[]")
    calls = []
    real = config._client

    def spy():
        c = real()
        orig = c.get_parameter

        def gp(**kw):
            calls.append(kw)
            return orig(**kw)

        c.get_parameter = gp
        return c

    monkeypatch.setattr(config, "_client", spy)
    events.for_day(dt.date(2026, 8, 5), TODAY)
    events.for_day(dt.date(2026, 8, 6), TODAY)
    assert len(calls) == 1 and calls[0]["WithDecryption"] is True
