"""Request validation for the journal API.

Whitelists the fields of the canonical shapes in `frontend/src/lib/types.ts` (Trade, DayNote, Account,
Settings), drops anything else, coerces numbers to Decimal for DynamoDB, and raises `ValidationError`
(→ 400 `{error}`) on anything out of bounds. Server-owned fields (createdAt/updatedAt) are set by the
caller in app.py, not here.
"""

from __future__ import annotations

import copy
import datetime as dt
import math
import re
from decimal import Decimal, InvalidOperation

MAX_STR = 200
MAX_NOTES = 5000
MAX_PHOTOS = 6
MAX_CHIPS = 100  # setups / mistakes / fee keys
MAX_RECENT_SYMBOLS = 8

# Ids are client-generated (ULID-like or an import fingerprint). They end up inside the DynamoDB sort key
# (`TRADE#<date>#<id>`) and the S3 photo key, so `#`, `/` and whitespace are not allowed.
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

ASSET_TYPES = {"futures", "option", "stock"}
SIDES = {"long", "short"}
SOURCES = {"manual", "tradovate", "ninjatrader", "webull", "robinhood", "generic"}
ACCOUNT_TYPES = {"personal", "prop-eval", "prop-funded"}
ACCOUNT_STATUSES = {"active", "passed", "failed", "archived"}
DRAWDOWN_TYPES = {"trailing", "static"}
BIASES = {"long", "short", "neutral"}

# Keep in sync with DEFAULT_SETTINGS in frontend/src/lib/types.ts.
DEFAULT_SETTINGS: dict = {
    "defaultAccountId": None,
    "feesPerContract": {"default": 0, "MNQ": 1.24, "MES": 1.24, "NQ": 4.28, "ES": 4.28},
    "breakevenBand": 0,
    "setups": ["Breakout", "Pullback", "Reversal", "Range fade", "Opening drive"],
    "mistakes": ["FOMO entry", "Moved stop", "Oversized", "Early exit", "Revenge trade", "No plan"],
    "recentSymbols": ["MNQ", "MES"],
}


class ValidationError(ValueError):
    pass


def default_settings() -> dict:
    return copy.deepcopy(DEFAULT_SETTINGS)


# ── primitives ──────────────────────────────────────────────────────────
def obj(value, field: str) -> dict:
    if not isinstance(value, dict):
        raise ValidationError(f"{field} must be an object")
    return value


def string(value, field: str, *, max_len: int = MAX_STR, min_len: int = 1) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    value = value.strip()
    if len(value) < min_len:
        raise ValidationError(f"{field} is required")
    if len(value) > max_len:
        raise ValidationError(f"{field} must be at most {max_len} characters")
    return value


def number(value, field: str, *, gt: float | None = None, ge: float | None = None) -> Decimal:
    """Accepts JSON numbers or numeric strings (CSV imports); never bools, NaN or infinity."""
    if isinstance(value, bool) or not isinstance(value, int | float | str | Decimal):
        raise ValidationError(f"{field} must be a number")
    if isinstance(value, float) and not math.isfinite(value):
        raise ValidationError(f"{field} must be a finite number")
    try:
        d = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise ValidationError(f"{field} must be a number") from exc
    if not d.is_finite():
        raise ValidationError(f"{field} must be a finite number")
    if abs(d) > Decimal("1e15"):
        raise ValidationError(f"{field} is out of range")
    if gt is not None and d <= Decimal(str(gt)):
        raise ValidationError(f"{field} must be greater than {gt}")
    if ge is not None and d < Decimal(str(ge)):
        raise ValidationError(f"{field} must be at least {ge}")
    return d


def date(value, field: str = "date") -> str:
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise ValidationError(f"{field} must be YYYY-MM-DD")
    try:
        dt.date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{field} is not a real date") from exc
    return value


def time(value, field: str) -> str:
    if not isinstance(value, str) or not TIME_RE.match(value):
        raise ValidationError(f"{field} must be HH:MM")
    return value


def ident(value, field: str = "id") -> str:
    if not isinstance(value, str) or not ID_RE.match(value):
        raise ValidationError(f"{field} must be 1-128 characters of letters, digits, '_', '.', ':' or '-'")
    return value


def enum(value, field: str, allowed: set[str]) -> str:
    if value not in allowed:
        raise ValidationError(f"{field} must be one of: {', '.join(sorted(allowed))}")
    return value


def mood(value, field: str = "mood") -> int:
    if isinstance(value, bool) or value not in (1, 2, 3, 4, 5):
        raise ValidationError(f"{field} must be 1-5")
    return int(value)


def string_list(value, field: str, *, max_items: int) -> list[str]:
    if not isinstance(value, list):
        raise ValidationError(f"{field} must be a list")
    if len(value) > max_items:
        raise ValidationError(f"{field} must have at most {max_items} items")
    return [string(v, f"{field}[]") for v in value]


def iso_timestamp(value) -> str | None:
    """A client-supplied ISO timestamp (createdAt on first write); None if unusable."""
    if not isinstance(value, str) or not 10 <= len(value) <= 40:
        return None
    try:
        dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value


def photo_key(value, sub: str) -> str:
    prefix = f"users/{sub}/"
    if (
        not isinstance(value, str)
        or not value.startswith(prefix)
        or len(value) > 512
        or ".." in value
        or "//" in value
    ):
        raise ValidationError("photo keys must belong to you")
    return value


def _present(body: dict, key: str) -> bool:
    return body.get(key) is not None


# ── shapes ──────────────────────────────────────────────────────────────
def trade(body, sub: str, trade_id: str | None = None) -> dict:
    """Validate a Trade. `trade_id` (from the path) wins; a conflicting body id is rejected."""
    b = obj(body, "trade")
    if trade_id is not None:
        if _present(b, "id") and b["id"] != trade_id:
            raise ValidationError("id in body does not match the URL")
        tid = ident(trade_id)
    else:
        tid = ident(b.get("id"))

    out: dict = {
        "id": tid,
        "accountId": None if b.get("accountId") is None else string(b["accountId"], "accountId"),
        "date": date(b.get("date")),
        "symbol": string(b.get("symbol"), "symbol"),
        "assetType": enum(b.get("assetType"), "assetType", ASSET_TYPES),
        "side": enum(b.get("side"), "side", SIDES),
        "qty": number(b.get("qty"), "qty", gt=0),
        "entry": number(b.get("entry"), "entry"),
        "exit": number(b.get("exit"), "exit"),
        "fees": number(b.get("fees", 0), "fees", ge=0),
        "multiplier": number(b.get("multiplier"), "multiplier", gt=0),
        "source": enum(b.get("source"), "source", SOURCES),
    }
    if _present(b, "time"):
        out["time"] = time(b["time"], "time")
    if _present(b, "exitTime"):
        out["exitTime"] = time(b["exitTime"], "exitTime")
    if _present(b, "option"):
        o = obj(b["option"], "option")
        out["option"] = {
            "underlying": string(o.get("underlying"), "option.underlying"),
            "right": enum(o.get("right"), "option.right", {"C", "P"}),
            "strike": number(o.get("strike"), "option.strike", ge=0),
            "expiry": date(o.get("expiry"), "option.expiry"),
        }
    if _present(b, "setup"):
        out["setup"] = string(b["setup"], "setup")
    if _present(b, "mistakes"):
        out["mistakes"] = string_list(b["mistakes"], "mistakes", max_items=MAX_CHIPS)
    if _present(b, "mood"):
        out["mood"] = mood(b["mood"])
    if _present(b, "notes"):
        out["notes"] = string(b["notes"], "notes", max_len=MAX_NOTES, min_len=0)
    if _present(b, "stop"):
        out["stop"] = number(b["stop"], "stop")
    if _present(b, "photoKeys"):
        keys = b["photoKeys"]
        if not isinstance(keys, list):
            raise ValidationError("photoKeys must be a list")
        if len(keys) > MAX_PHOTOS:
            raise ValidationError(f"at most {MAX_PHOTOS} photos per trade")
        out["photoKeys"] = [photo_key(k, sub) for k in keys]
    created = iso_timestamp(b.get("createdAt"))
    if created:
        out["createdAt"] = created
    return out


def day_note(body, day: str) -> dict:
    b = obj(body, "day")
    day = date(day)
    if _present(b, "date") and b["date"] != day:
        raise ValidationError("date in body does not match the URL")
    out: dict = {"date": day}
    if _present(b, "plan"):
        p = obj(b["plan"], "plan")
        plan: dict = {}
        if _present(p, "bias"):
            plan["bias"] = enum(p["bias"], "plan.bias", BIASES)
        if _present(p, "levels"):
            plan["levels"] = string(p["levels"], "plan.levels", max_len=MAX_NOTES, min_len=0)
        if _present(p, "focus"):
            plan["focus"] = string(p["focus"], "plan.focus", max_len=MAX_NOTES, min_len=0)
        out["plan"] = plan
    if _present(b, "review"):
        r = obj(b["review"], "review")
        review: dict = {}
        if _present(r, "text"):
            review["text"] = string(r["text"], "review.text", max_len=MAX_NOTES, min_len=0)
        if "followedPlan" in r:
            fp = r["followedPlan"]
            if fp is not None and not isinstance(fp, bool):
                raise ValidationError("review.followedPlan must be true, false or null")
            review["followedPlan"] = fp
        if _present(r, "mood"):
            review["mood"] = mood(r["mood"], "review.mood")
        out["review"] = review
    return out


def account(body, account_id: str) -> dict:
    b = obj(body, "account")
    aid = ident(account_id)
    if _present(b, "id") and b["id"] != aid:
        raise ValidationError("id in body does not match the URL")
    out: dict = {
        "id": aid,
        "name": string(b.get("name"), "name"),
        "type": enum(b.get("type"), "type", ACCOUNT_TYPES),
        "startBalance": number(b.get("startBalance"), "startBalance"),
        "status": enum(b.get("status", "active"), "status", ACCOUNT_STATUSES),
    }
    for field in ("profitTarget", "maxDrawdown", "dailyLossLimit"):
        if _present(b, field):
            out[field] = number(b[field], field, ge=0)
    if _present(b, "drawdownType"):
        out["drawdownType"] = enum(b["drawdownType"], "drawdownType", DRAWDOWN_TYPES)
    created = iso_timestamp(b.get("createdAt"))
    if created:
        out["createdAt"] = created
    return out


def settings(body, current: dict) -> dict:
    """Overlay the provided Settings fields on `current` (stored settings or the defaults)."""
    b = obj(body, "settings")
    out = dict(current)
    if "defaultAccountId" in b:
        v = b["defaultAccountId"]
        out["defaultAccountId"] = None if v is None else string(v, "defaultAccountId")
    if _present(b, "feesPerContract"):
        fees = obj(b["feesPerContract"], "feesPerContract")
        if len(fees) > MAX_CHIPS:
            raise ValidationError(f"feesPerContract must have at most {MAX_CHIPS} entries")
        out["feesPerContract"] = {
            string(k, "feesPerContract key", max_len=32): number(v, f"feesPerContract.{k}", ge=0)
            for k, v in fees.items()
        }
    if _present(b, "breakevenBand"):
        out["breakevenBand"] = number(b["breakevenBand"], "breakevenBand", ge=0)
    if _present(b, "setups"):
        out["setups"] = string_list(b["setups"], "setups", max_items=MAX_CHIPS)
    if _present(b, "mistakes"):
        out["mistakes"] = string_list(b["mistakes"], "mistakes", max_items=MAX_CHIPS)
    if _present(b, "recentSymbols"):
        syms = b["recentSymbols"]
        if not isinstance(syms, list):
            raise ValidationError("recentSymbols must be a list")
        out["recentSymbols"] = [string(s, "recentSymbols[]") for s in syms[:MAX_RECENT_SYMBOLS]]
    return out


def to_dynamo(value):
    """Floats → Decimal (boto3's DynamoDB serializer rejects float)."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_dynamo(v) for v in value]
    return value


def from_dynamo(value):
    """Decimal → int/float for JSON output."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: from_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [from_dynamo(v) for v in value]
    return value
