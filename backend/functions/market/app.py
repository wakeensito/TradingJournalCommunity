"""market Lambda — zero-input market context for the journal (see docs/market-context.md).

Routes (behind the HTTP API Cognito JWT authorizer; `sub` is required but the data is shared, not per user):
  GET /api/market/day/{date}   → index/VIX closes + USD high/medium events for one ET day
  GET /api/market/bars         → Yahoo intraday bars (1m ≤ 7 days old, 5m ≤ 60 days) for one ET day

Every source fails independently: one broken provider nulls/empties its section, never the response.
Never log API keys or query strings.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.logging import correlation_paths
from mktdata import cache, clock, config, events, fred, http, symbols, yahoo
from mktdata.errors import UpstreamError

logger = Logger()

DAY_TTL_S = 30 * 60  # today / future / incomplete past day
DAY_UNAVAILABLE_TTL_S = 24 * 3600  # past day complete except FMP-not-in-plan events: spare the shared FMP key
BARS_TODAY_TTL_S = 2 * 60
MAX_FUTURE_DAYS = 31
MIN_DATE = dt.date(2000, 1, 1)
SOURCE_WAIT_S = 12  # per-source wait; Lambda timeout is 20s
INDEX_SYMBOLS = {"ES": "ES=F", "NQ": "NQ=F"}
VIX_SYMBOL = "^VIX"
_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
OLD_BARS_MESSAGE = "Intraday bars older than 60 days aren't available"

# One shared pool, never per call: a hung yfinance request keeps its worker until its own timeout fires.
_POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="market")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _dumps(obj) -> str:
    return json.dumps(obj, separators=(",", ":"))


app = APIGatewayHttpResolver(strip_prefixes=["/api"], serializer=_dumps)


def _error(status: int, message: str) -> Response:
    return Response(status_code=status, content_type="application/json", body=_dumps({"error": message}))


@app.exception_handler(ApiError)
def _api_error(err: ApiError):
    return _error(err.status, err.message)


@app.not_found
def _not_found(_exc):
    return _error(404, "Not found")


@app.exception_handler(Exception)
def _unexpected(_err: Exception):
    logger.exception("unhandled error")
    return _error(500, "Something went wrong on our side. Please try again.")


def _require_sub() -> str:
    claims = (
        ((app.current_event.raw_event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}
    ).get("claims") or {}
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ApiError(401, "Unauthorized")
    return sub


def _parse_date(raw: str | None) -> dt.date:
    if not raw or not _DATE_RE.fullmatch(raw):
        raise ApiError(400, "date must be YYYY-MM-DD")
    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        raise ApiError(400, "date must be a real calendar day") from None


def _wait(future, label: str):
    """Result of a source future, or the UpstreamError it failed with (timeouts included)."""
    try:
        return future.result(timeout=SOURCE_WAIT_S)
    except FutureTimeout:
        return UpstreamError(label, f"timed out after {SOURCE_WAIT_S}s")
    except UpstreamError as err:
        return err


# ── Day context ────────────────────────────────────────────────────────
def _close_and_prev(rows: list[tuple[str, float]], day: dt.date) -> tuple[float | None, float | None]:
    target = day.isoformat()
    prev = None
    for day_s, close in sorted(rows):
        if day_s == target:
            return close, prev
        if day_s < target:
            prev = close
    return None, prev


def _index_value(rows, day: dt.date) -> dict | None:
    close, prev = _close_and_prev(rows, day)
    if close is None:
        return None  # market closed that day
    pct = round((close / prev - 1) * 100, 2) if prev else None
    return {"close": round(close, 2), "changePct": pct}


def _vix_value(rows, day: dt.date) -> dict | None:
    close, prev = _close_and_prev(rows, day)
    if close is None:
        return None
    return {"close": round(close, 2), "change": round(close - prev, 2) if prev is not None else None}


def _fred_vix(day: dt.date) -> dict | None:
    return _vix_value(fred.observations("VIXCLS", day - dt.timedelta(days=10), day), day)


def build_day(day: dt.date, today: dt.date) -> dict:
    window = (day - dt.timedelta(days=10), day + dt.timedelta(days=1))
    has_prices = day <= today
    futs = {}
    if has_prices:
        for key, sym in {**INDEX_SYMBOLS, "VIX": VIX_SYMBOL}.items():
            futs[key] = _POOL.submit(yahoo.daily_closes, sym, *window)
    fut_events = _POOL.submit(events.for_day, day, today)

    indices: dict[str, dict | None] = {k: None for k in INDEX_SYMBOLS}
    sources: dict[str, str] = {}
    if has_prices:
        failed = 0
        for key in INDEX_SYMBOLS:
            res = _wait(futs[key], "yahoo")
            if isinstance(res, UpstreamError):
                failed += 1
                logger.warning("index source failed", extra={"index": key, "detail": res.detail})
            else:
                indices[key] = _index_value(res, day)
        sources["indices"] = (
            "yahoo" if failed == 0 else ("error" if failed == len(INDEX_SYMBOLS) else "partial")
        )
    else:
        sources["indices"] = "none"

    vix = None
    if has_prices:
        res = _wait(futs["VIX"], "yahoo")
        yahoo_ok = not isinstance(res, UpstreamError)
        if yahoo_ok:
            vix = _vix_value(res, day)
        else:
            logger.warning("vix source failed", extra={"detail": res.detail})
        sources["vix"] = "yahoo" if yahoo_ok else "error"
        if vix is None and (not yahoo_ok or day.weekday() < 5):  # failed or skipped a weekday → FRED
            try:
                fred_vix = _fred_vix(day)
                if fred_vix is not None or not yahoo_ok:
                    vix, sources["vix"] = fred_vix, "fred"
            except UpstreamError as err:
                logger.warning("fred vix failed", extra={"detail": err.detail})
    else:
        sources["vix"] = "none"

    ev = _wait(fut_events, "events")
    if isinstance(ev, UpstreamError):  # only a timeout can land here; for_day never raises
        event_list, sources["events"] = [], "error"
    else:
        event_list, sources["events"] = ev

    return {"date": day.isoformat(), "indices": indices, "vix": vix, "events": event_list, "sources": sources}


def _day_ttl(body: dict, day: dt.date, today: dt.date) -> int | None:
    s = body["sources"]
    prices_ok = s.get("indices") == "yahoo" and s.get("vix") in ("yahoo", "fred")
    if day < today and prices_ok:
        if s.get("events") in ("forexfactory", "fmp"):
            return None  # settled history: cache forever
        if s.get("events") == "unavailable":
            return DAY_UNAVAILABLE_TTL_S
    return DAY_TTL_S


@app.get("/market/day/<date>")
def market_day(date: str):
    _require_sub()
    day = _parse_date(date)
    today = clock.today_et()
    if day < MIN_DATE or day > today + dt.timedelta(days=MAX_FUTURE_DAYS):
        raise ApiError(
            400, f"date must be between {MIN_DATE.isoformat()} and {MAX_FUTURE_DAYS} days from now"
        )
    sk = f"DAY#{day.isoformat()}"
    hit = cache.get(sk)
    if hit is not None:
        return hit
    body = build_day(day, today)
    cache.put(sk, body, ttl_seconds=_day_ttl(body, day, today))
    return body


# ── Intraday bars ──────────────────────────────────────────────────────
def _bars_body(symbol: str, interval: str, rows: list) -> dict:
    return {
        "symbol": symbol,
        "interval": interval,
        "bars": [{"t": r[0], "o": r[1], "h": r[2], "l": r[3], "c": r[4], "v": r[5]} for r in rows],
        "tz": "America/New_York",
    }


@app.get("/market/bars")
def market_bars():
    _require_sub()
    q = app.current_event.query_string_parameters or {}
    raw_symbol = (q.get("symbol") or "").strip()
    if len(raw_symbol) > 60:
        raise ApiError(400, "symbol is too long")
    day = _parse_date(q.get("date"))
    asset_type = (q.get("assetType") or "stock").strip().lower()
    underlying = (q.get("underlying") or "").strip()[:20] or None
    try:
        candidates = symbols.yahoo_candidates(raw_symbol, asset_type, underlying)
    except LookupError as err:
        raise ApiError(404, str(err.args[0])) from None
    except ValueError as err:
        raise ApiError(400, str(err)) from None

    today = clock.today_et()
    if day > today:
        raise ApiError(400, "No bars for future dates")
    interval = symbols.interval_for(day, today)
    if interval is None:
        raise ApiError(404, OLD_BARS_MESSAGE)

    keys = {sym: f"BARS#{sym}#{day.isoformat()}#{interval}" for sym in candidates}
    for sym in candidates:
        hit = cache.get(keys[sym])
        if hit is not None:
            return _bars_body(sym, interval, hit)

    errors = 0
    for sym in candidates:
        try:
            rows = yahoo.intraday(sym, day, interval)
        except UpstreamError as err:
            errors += 1
            logger.warning("yahoo intraday failed", extra={"detail": err.detail})
            continue
        if rows:
            cache.put(keys[sym], rows, ttl_seconds=None if day < today else BARS_TODAY_TTL_S)
            return _bars_body(sym, interval, rows)
    if errors == len(candidates):
        raise ApiError(502, "Chart data is unavailable right now. Try again later.")
    raise ApiError(404, "No intraday bars for that day")


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
def lambda_handler(event, context):
    return app.resolve(event, context)


def clear_caches() -> None:
    """Per-container caches (tests call this between cases)."""
    cache.reset()
    config.reset()
    http.reset()
    events.reset()
