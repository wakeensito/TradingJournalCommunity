import datetime as dt

import pytest
from mktdata import symbols


@pytest.mark.parametrize(
    ("raw", "root"),
    [
        ("MNQZ5", "MNQ"),
        ("MNQZ25", "MNQ"),
        ("MNQ 12-25", "MNQ"),
        ("MNQ", "MNQ"),
        ("mnqz5", "MNQ"),
        ("/ESZ5", "ES"),
        ("ES 03-26", "ES"),
        ("MESH6", "MES"),
        ("M2KZ5", "M2K"),
        ("6EZ5", "6E"),
        ("MGCG26", "MGC"),
        ("CLX5", "CL"),
        ("MNQ1!", "MNQ"),
        ("ZZZZ5", None),
        ("AAPL", None),
        ("", None),
    ],
)
def test_futures_root(raw, root):
    assert symbols.futures_root(raw) == root


def test_futures_candidates_prefer_micro_then_full_size():
    assert symbols.yahoo_candidates("MNQZ5", "futures") == ("MNQ=F", "NQ=F")
    assert symbols.yahoo_candidates("MES 12-25", "futures") == ("MES=F", "ES=F")
    assert symbols.yahoo_candidates("ESZ5", "futures") == ("ES=F",)
    assert symbols.yahoo_candidates("M2KZ5", "futures") == ("M2K=F", "RTY=F")


def test_unknown_future_is_lookup_error():
    with pytest.raises(LookupError):
        symbols.yahoo_candidates("FOOZ5", "futures")


def test_options_chart_the_underlying():
    assert symbols.yahoo_candidates("SPY 500C 12/19", "option") == ("SPY",)
    assert symbols.yahoo_candidates("whatever", "option", underlying="qqq") == ("QQQ",)
    assert symbols.yahoo_candidates("SPXW 6000P 10/13", "option") == ("^SPX",)


def test_stocks_as_is_with_yahoo_spelling():
    assert symbols.yahoo_candidates("aapl", "stock") == ("AAPL",)
    assert symbols.yahoo_candidates("BRK.B", "stock") == ("BRK-B",)


@pytest.mark.parametrize("bad", [("$$$", "stock"), ("AAPL", "crypto"), ("  ", "stock")])
def test_bad_input_is_value_error(bad):
    with pytest.raises(ValueError):
        symbols.yahoo_candidates(*bad)


@pytest.mark.parametrize(
    ("age", "interval"),
    [(-1, None), (0, "1m"), (6, "1m"), (7, "5m"), (59, "5m"), (60, None), (400, None)],
)
def test_interval_by_age(age, interval):
    today = dt.date(2026, 10, 13)
    assert symbols.interval_for(today - dt.timedelta(days=age), today) == interval
