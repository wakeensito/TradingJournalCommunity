"""Map a symbol *as traded* to Yahoo symbols, and pick the bar interval Yahoo can serve for a day."""

from __future__ import annotations

import datetime as dt
import re

# Root → Yahoo continuous contracts, micro first (same price as the full-size, which is the fallback).
FUTURES_YAHOO: dict[str, tuple[str, ...]] = {
    "ES": ("ES=F",),
    "MES": ("MES=F", "ES=F"),
    "NQ": ("NQ=F",),
    "MNQ": ("MNQ=F", "NQ=F"),
    "YM": ("YM=F",),
    "MYM": ("MYM=F", "YM=F"),
    "RTY": ("RTY=F",),
    "M2K": ("M2K=F", "RTY=F"),
    "CL": ("CL=F",),
    "MCL": ("MCL=F", "CL=F"),
    "GC": ("GC=F",),
    "MGC": ("MGC=F", "GC=F"),
    "SI": ("SI=F",),
    "NG": ("NG=F",),
    "6E": ("6E=F",),
    "ZB": ("ZB=F",),
    "ZN": ("ZN=F",),
}
# Cash-index option roots trade against an index Yahoo prefixes with '^'.
INDEX_UNDERLYINGS = {
    "SPX": "^SPX",
    "SPXW": "^SPX",
    "NDX": "^NDX",
    "NDXP": "^NDX",
    "RUT": "^RUT",
    "VIX": "^VIX",
}
_MONTH_YEAR = re.compile(r"[FGHJKMNQUVXZ]\d{1,4}")
_TICKER = re.compile(r"[A-Z0-9][A-Z0-9-]{0,11}")
_ROOTS_LONGEST_FIRST = sorted(FUTURES_YAHOO, key=len, reverse=True)

ONE_MINUTE_DAYS = 7
MAX_INTRADAY_DAYS = 60


def _first_token(symbol: str) -> str:
    s = symbol.strip().upper().lstrip("/")
    return re.split(r"[\s_:]+", s, maxsplit=1)[0] if s else ""


def futures_root(symbol: str) -> str | None:
    """'MNQZ5', 'MNQZ25', 'MNQ 12-25', '/ESZ5', 'MNQ' → 'MNQ'. Unknown roots → None."""
    token = _first_token(symbol)
    token = token.split("-", 1)[0]  # 'MNQ-12-25'
    token = re.sub(r"\d*!$", "", token)  # 'MNQ1!' (TradingView continuous)
    token = re.sub(r"[^A-Z0-9]", "", token)
    if token in FUTURES_YAHOO:
        return token
    for root in _ROOTS_LONGEST_FIRST:
        if token.startswith(root) and _MONTH_YEAR.fullmatch(token[len(root) :]):
            return root
    return None


def _ticker(raw: str) -> str:
    t = _first_token(raw).replace(".", "-").replace("/", "-")  # BRK.B → BRK-B (Yahoo's spelling)
    if t in INDEX_UNDERLYINGS:
        return INDEX_UNDERLYINGS[t]
    if not _TICKER.fullmatch(t):
        raise ValueError("symbol is not a valid ticker")
    return t


def yahoo_candidates(symbol: str, asset_type: str, underlying: str | None = None) -> tuple[str, ...]:
    """Yahoo symbols to try in order. Raises ValueError for bad input, LookupError for an unmapped future."""
    if not symbol or not symbol.strip():
        raise ValueError("symbol is required")
    if asset_type == "futures":
        root = futures_root(symbol)
        if root is None:
            raise LookupError("No chart data for this contract")
        return FUTURES_YAHOO[root]
    if asset_type == "option":
        return (_ticker(underlying or symbol),)
    if asset_type == "stock":
        return (_ticker(symbol),)
    raise ValueError("assetType must be futures, option or stock")


def interval_for(day: dt.date, today: dt.date) -> str | None:
    """'1m' within the last 7 days, '5m' within 60 (Yahoo's intraday limits), else None. Future → None."""
    age = (today - day).days
    if age < 0:
        return None
    if age < ONE_MINUTE_DAYS:
        return "1m"
    if age < MAX_INTRADAY_DAYS:
        return "5m"
    return None
