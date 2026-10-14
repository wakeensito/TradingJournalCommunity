"""USD high/medium-impact economic events for one ET day.

1. Forex Factory's keyless weekly JSON (this week / next week only; heavily rate-limited, so the feed is
   cached in DynamoDB for an hour).
2. FMP /stable/economic-calendar for any other day (or when FF fails). 401/402/403 or a missing key →
   `Unavailable` (the plan doesn't include it); that answer is remembered per container for 6 hours so the
   shared ClearVest key's daily quota isn't burned re-asking.
"""

from __future__ import annotations

import datetime as dt
import math

from aws_lambda_powertools import Logger

from mktdata import cache, clock, config, http
from mktdata.clock import NY
from mktdata.errors import Unavailable, UpstreamError

FF_URLS = {
    "thisweek": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "nextweek": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
}
FF_CACHE_TTL = 3600
FMP_URL = "https://financialmodelingprep.com/stable/economic-calendar"
FMP_PLAN_STATUSES = (401, 402, 403)
FMP_UNAVAILABLE_MEMO_S = 6 * 3600
IMPACTS = {"high": "high", "medium": "medium"}
_IMPACT_RANK = {"high": 0, "medium": 1, "low": 2}

logger = Logger(child=True)
_fmp_unavailable_until = 0


def week_start(day: dt.date) -> dt.date:
    """Forex Factory weeks run Sunday → Saturday."""
    return day - dt.timedelta(days=(day.weekday() + 1) % 7)


def ff_week_for(day: dt.date, today: dt.date) -> str | None:
    ws = week_start(today)
    if ws <= day < ws + dt.timedelta(days=7):
        return "thisweek"
    if ws + dt.timedelta(days=7) <= day < ws + dt.timedelta(days=14):
        return "nextweek"
    return None


def _text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        if not math.isfinite(value):
            return None
        return f"{value:g}"
    s = str(value).strip()
    return s or None


def _event(when_et: dt.datetime, title, impact: str, actual=None, forecast=None, previous=None) -> dict:
    ev = {"time": when_et.strftime("%H:%M"), "title": str(title).strip()[:120], "impact": impact}
    for key, val in (("actual", actual), ("forecast", forecast), ("previous", previous)):
        t = _text(val)
        if t is not None:
            ev[key] = t[:40]
    return ev


def _sorted(events: list[dict]) -> list[dict]:
    return sorted(events, key=lambda e: (e["time"], _IMPACT_RANK.get(e["impact"], 9), e["title"]))


# ── Forex Factory ──────────────────────────────────────────────────────
def _ff_feed(which: str, today: dt.date) -> list:
    sk = f"FF#{which}#{week_start(today).isoformat()}"
    cached = cache.get(sk)
    if isinstance(cached, list):
        return cached
    data = http.request_json("GET", FF_URLS[which], provider="forexfactory", timeout=5)
    if not isinstance(data, list):
        raise UpstreamError("forexfactory", "unexpected response")
    cache.put(sk, data, ttl_seconds=FF_CACHE_TTL)
    return data


def ff_events(rows: list, day: dt.date) -> list[dict]:
    out = []
    for row in rows:
        if not isinstance(row, dict) or str(row.get("country", "")).upper() != "USD":
            continue
        impact = IMPACTS.get(str(row.get("impact", "")).strip().lower())
        if impact is None or not row.get("title"):
            continue
        try:
            when = dt.datetime.fromisoformat(str(row.get("date")))
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=NY)  # FF always sends an offset; assume ET if it ever doesn't
        when = when.astimezone(NY)
        if when.date() != day:
            continue
        out.append(
            _event(when, row["title"], impact, row.get("actual"), row.get("forecast"), row.get("previous"))
        )
    return _sorted(out)


# ── FMP ────────────────────────────────────────────────────────────────
def fmp_rows(day: dt.date) -> list:
    global _fmp_unavailable_until
    if clock.epoch() < _fmp_unavailable_until:
        raise Unavailable("fmp", "economic calendar not in plan (memoized)")
    try:
        key = config.fmp_key()
        # FMP dates are UTC and an ET day spans two UTC days.
        data = http.request_json(
            "GET",
            FMP_URL,
            provider="fmp",
            timeout=5,
            params={"from": day.isoformat(), "to": (day + dt.timedelta(days=1)).isoformat(), "apikey": key},
        )
    except Unavailable:
        _fmp_unavailable_until = clock.epoch() + FMP_UNAVAILABLE_MEMO_S
        raise
    except UpstreamError as err:
        if err.status in FMP_PLAN_STATUSES:
            _fmp_unavailable_until = clock.epoch() + FMP_UNAVAILABLE_MEMO_S
            raise Unavailable("fmp", f"HTTP {err.status}", status=err.status) from err
        raise
    if isinstance(data, dict) and ("Error Message" in data or "error" in data):
        _fmp_unavailable_until = clock.epoch() + FMP_UNAVAILABLE_MEMO_S
        raise Unavailable("fmp", "error message in 200 response")
    if not isinstance(data, list):
        raise UpstreamError("fmp", "unexpected response")
    return data


def fmp_events(rows: list, day: dt.date) -> list[dict]:
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        country = str(row.get("country", "")).upper()
        currency = str(row.get("currency", "")).upper()
        if country not in ("US", "USA") and currency != "USD":
            continue
        impact = IMPACTS.get(str(row.get("impact", "")).strip().lower())
        title = row.get("event")
        if impact is None or not title:
            continue
        try:
            when = dt.datetime.fromisoformat(str(row.get("date")).replace(" ", "T"))
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=dt.UTC)
        when = when.astimezone(NY)
        if when.date() != day:
            continue
        out.append(_event(when, title, impact, row.get("actual"), row.get("estimate"), row.get("previous")))
    return _sorted(out)


# ── Public ─────────────────────────────────────────────────────────────
def for_day(day: dt.date, today: dt.date) -> tuple[list[dict], str]:
    """(events, source) where source is 'forexfactory' | 'fmp' | 'unavailable' | 'error'. Never raises."""
    which = ff_week_for(day, today)
    if which:
        try:
            return ff_events(_ff_feed(which, today), day), "forexfactory"
        except UpstreamError as err:
            logger.warning("forex factory failed", extra={"detail": err.detail})
    try:
        return fmp_events(fmp_rows(day), day), "fmp"
    except Unavailable as err:
        logger.info("fmp calendar unavailable", extra={"detail": err.detail})
        return [], "unavailable"
    except UpstreamError as err:
        logger.warning("fmp calendar failed", extra={"detail": err.detail})
        return [], "error"


def reset() -> None:
    global _fmp_unavailable_until
    _fmp_unavailable_until = 0
