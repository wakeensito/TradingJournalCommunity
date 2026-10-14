"""AI coach: a compact, server-computed summary of a date range + one Bedrock Converse call.

The P&L formula mirrors `frontend/src/lib/pnl.ts` (the one exception to "the API never computes stats"):
gross = (exit - entry) * qty * multiplier * (+1 long / -1 short); net = gross - fees.
The model only sees this summary, never raw trade rows, and is told never to invent numbers.
"""

from __future__ import annotations

import json
from collections import defaultdict
from decimal import Decimal

MAX_TRADES = 400
MAX_REVIEW_CHARS = 240
MAX_DAY_NOTES = 31

SYSTEM_PROMPT = """You are a supportive but blunt trading coach for a discretionary day trader (futures and \
options). They are not a quant: talk about behaviour, setups and discipline, not statistics jargon.

You receive a JSON summary of their journal for a date range. Rules:
- Reference ONLY the provided data. Never invent, estimate or extrapolate numbers, trades, setups or dates.
- Quote dollar figures exactly as given (they already include fees).
- If the data is thin (few trades, no notes), say so plainly instead of guessing.
- Be warm but direct. No disclaimers, no financial advice boilerplate, no generic platitudes.
- At most 180 words in total.

Unless the user asks a specific question, answer in exactly three short sections with these headings:
What worked
What cost you
One focus for next week
("One focus" is a single concrete, checkable behaviour.)

If the user asks a question, answer that question directly in the same voice, using the same data and \
the same rules, still at most 180 words."""


def _d(value) -> Decimal:
    if value is None:
        return Decimal(0)
    return value if isinstance(value, Decimal) else Decimal(str(value))


def net_pnl(trade: dict) -> Decimal:
    sign = 1 if trade.get("side") == "long" else -1
    gross = (
        (_d(trade.get("exit")) - _d(trade.get("entry")))
        * _d(trade.get("qty"))
        * _d(trade.get("multiplier") or 1)
    )
    return gross * sign - _d(trade.get("fees"))


def _money(value: Decimal) -> float:
    return float(round(value, 2))


def _sort_key(trade: dict) -> tuple[str, str, str]:
    return (trade.get("date", ""), trade.get("time", ""), trade.get("id", ""))


def summarize(trades: list[dict], days: list[dict], *, start: str, end: str, breakeven_band) -> dict:
    """Compact summary of the newest ≤ MAX_TRADES trades in range + day reviews. Pure function."""
    band = abs(_d(breakeven_band))
    total_in_range = len(trades)
    trades = sorted(trades, key=_sort_key, reverse=True)[:MAX_TRADES]

    wins = losses = breakevens = 0
    total_net = total_fees = gross_wins = gross_losses = Decimal(0)
    by_day: dict[str, Decimal] = defaultdict(Decimal)
    setups: dict[str, dict] = defaultdict(lambda: {"trades": 0, "wins": 0, "net": Decimal(0)})
    symbols: dict[str, dict] = defaultdict(lambda: {"trades": 0, "net": Decimal(0)})
    mistakes: dict[str, dict] = defaultdict(lambda: {"trades": 0, "net": Decimal(0)})
    clean = {"trades": 0, "net": Decimal(0)}

    for t in trades:
        net = net_pnl(t)
        total_net += net
        total_fees += _d(t.get("fees"))
        by_day[t.get("date", "")] += net
        if abs(net) <= band:
            breakevens += 1
            outcome = "be"
        elif net > 0:
            wins += 1
            gross_wins += net
            outcome = "win"
        else:
            losses += 1
            gross_losses += net
            outcome = "loss"
        s = setups[t.get("setup") or "(no setup)"]
        s["trades"] += 1
        s["net"] += net
        s["wins"] += outcome == "win"
        sym = symbols[str(t.get("symbol", "?"))]
        sym["trades"] += 1
        sym["net"] += net
        tagged = t.get("mistakes") or []
        for m in tagged:
            mistakes[m]["trades"] += 1
            mistakes[m]["net"] += net
        if not tagged:
            clean["trades"] += 1
            clean["net"] += net

    decided = wins + losses
    day_values = sorted(by_day.items())
    best = max(day_values, key=lambda kv: kv[1]) if day_values else None
    worst = min(day_values, key=lambda kv: kv[1]) if day_values else None

    top_setups = sorted(setups.items(), key=lambda kv: (-kv[1]["trades"], kv[1]["net"]))[:6]
    top_symbols = sorted(symbols.items(), key=lambda kv: -kv[1]["trades"])[:5]
    costly = sorted(mistakes.items(), key=lambda kv: kv[1]["net"])[:6]

    reviews = []
    for day in sorted(days, key=lambda d: d.get("date", ""), reverse=True)[:MAX_DAY_NOTES]:
        review = day.get("review") or {}
        plan = day.get("plan") or {}
        entry: dict = {"date": day.get("date")}
        if review.get("text"):
            entry["review"] = str(review["text"])[:MAX_REVIEW_CHARS]
        if review.get("followedPlan") is not None:
            entry["followedPlan"] = bool(review["followedPlan"])
        if review.get("mood") is not None:
            entry["mood"] = int(review["mood"])
        if plan.get("focus"):
            entry["planFocus"] = str(plan["focus"])[:MAX_REVIEW_CHARS]
        if len(entry) > 1:
            reviews.append(entry)

    return {
        "range": {"from": start, "to": end},
        "tradesAnalyzed": len(trades),
        "tradesInRange": total_in_range,
        "netPnl": _money(total_net),
        "feesPaid": _money(total_fees),
        "wins": wins,
        "losses": losses,
        "breakevens": breakevens,
        "winRatePct": round(100 * wins / decided, 1) if decided else None,
        "avgWin": _money(gross_wins / wins) if wins else None,
        "avgLoss": _money(gross_losses / losses) if losses else None,
        "daysTraded": len(day_values),
        "greenDays": sum(1 for _, v in day_values if v > 0),
        "redDays": sum(1 for _, v in day_values if v < 0),
        "bestDay": {"date": best[0], "net": _money(best[1])} if best else None,
        "worstDay": {"date": worst[0], "net": _money(worst[1])} if worst else None,
        "setups": [
            {
                "setup": k,
                "trades": v["trades"],
                "wins": v["wins"],
                "net": _money(v["net"]),
            }
            for k, v in top_setups
        ],
        "symbols": [{"symbol": k, "trades": v["trades"], "net": _money(v["net"])} for k, v in top_symbols],
        "mistakes": [{"mistake": k, "trades": v["trades"], "netCost": _money(v["net"])} for k, v in costly],
        "tradesWithoutMistakes": {"trades": clean["trades"], "net": _money(clean["net"])},
        "dayNotes": reviews,
    }


def build_messages(summary: dict, question: str | None) -> list[dict]:
    data = json.dumps(summary, separators=(",", ":"))
    if question:
        ask = f"My question: {question}"
    else:
        ask = "Review this period for me."
    text = f"Journal summary (JSON):\n{data}\n\n{ask}"
    return [{"role": "user", "content": [{"text": text}]}]


def converse(client, model_id: str, summary: dict, question: str | None) -> str:
    """One Converse call. Raises botocore errors to the caller (→ 502)."""
    response = client.converse(
        modelId=model_id,
        system=[{"text": SYSTEM_PROMPT}],
        messages=build_messages(summary, question),
        inferenceConfig={"maxTokens": 600, "temperature": 0.3},
    )
    blocks = ((response.get("output") or {}).get("message") or {}).get("content") or []
    # Reasoning models may also return `reasoningContent` blocks; only plain text is shown.
    text = "\n".join(b["text"] for b in blocks if isinstance(b, dict) and b.get("text")).strip()
    return text
