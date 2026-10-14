"""Yahoo Finance via yfinance (keyless, unofficial). Adapted from ClearVest's providers/yahoo.py.

Only `.empty` and `.iterrows()` are used on the returned frame (rows read with `.get`), so tests can pass a
tiny fake instead of pandas.
"""

from __future__ import annotations

import datetime as dt
import math

from mktdata.clock import NY
from mktdata.errors import UpstreamError

DAILY_TIMEOUT = 4
INTRADAY_TIMEOUT = 6


def _yf():
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    # Lambda's filesystem is read-only except /tmp; yfinance caches timezones on disk.
    yf.set_tz_cache_location("/tmp/yfinance")  # noqa: S108 - the only writable dir on Lambda
    return yf


def _num(value) -> float | None:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def daily_closes(symbol: str, start: dt.date, end: dt.date) -> list[tuple[str, float]]:
    """[(YYYY-MM-DD, close)] for start <= day < end. Raises UpstreamError on failure or no data."""
    try:
        frame = (
            _yf()
            .Ticker(symbol)
            .history(
                start=start.isoformat(),
                end=end.isoformat(),
                interval="1d",
                auto_adjust=False,
                timeout=DAILY_TIMEOUT,
            )
        )
    except Exception as err:  # noqa: BLE001 - yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__} for {symbol}") from err
    if frame is None or frame.empty:
        raise UpstreamError("yahoo", f"no daily data for {symbol}")
    out = []
    for ts, row in frame.iterrows():
        close = _num(row.get("Close"))
        if close is not None:
            out.append((ts.strftime("%Y-%m-%d"), round(close, 4)))
    if not out:
        raise UpstreamError("yahoo", f"no daily closes for {symbol}")
    return out


def intraday(symbol: str, day: dt.date, interval: str) -> list[list[float]]:
    """Compact rows [[t, o, h, l, c, v], …] for the ET calendar day (pre/post + overnight included).

    An empty list means Yahoo had nothing (holiday, weekend, unknown symbol); errors raise UpstreamError.
    """
    start = dt.datetime.combine(day, dt.time(0), NY)
    end = start + dt.timedelta(days=1)
    try:
        frame = (
            _yf()
            .Ticker(symbol)
            .history(
                start=start,
                end=end,
                interval=interval,
                prepost=True,
                auto_adjust=False,
                timeout=INTRADAY_TIMEOUT,
            )
        )
    except Exception as err:  # noqa: BLE001
        raise UpstreamError("yahoo", f"{type(err).__name__} for {symbol} {interval}") from err
    if frame is None or frame.empty:
        return []
    lo, hi = int(start.timestamp()), int(end.timestamp())
    rows: list[list[float]] = []
    for ts, row in frame.iterrows():
        t = int(ts.timestamp())
        o, h, low, c = (_num(row.get(k)) for k in ("Open", "High", "Low", "Close"))
        if not (lo <= t < hi) or None in (o, h, low, c):
            continue
        v = _num(row.get("Volume")) or 0
        rows.append([t, _round(o), _round(h), _round(low), _round(c), int(v)])
    rows.sort(key=lambda r: r[0])
    return rows


def _round(x: float | None) -> float:
    return round(float(x or 0), 4)
