"""AI coach: server-side summary math + the Bedrock Converse call (stubbed; no real AWS)."""

from __future__ import annotations

from decimal import Decimal

import app as api
import coach
import pytest
from botocore.exceptions import ClientError
from helpers import USER_B, call, trade


class StubBedrock:
    def __init__(self, text="What worked\n...", error=None):
        self.text = text
        self.error = error
        self.calls: list[dict] = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {"reasoningContent": {"reasoningText": {"text": "hmm"}}},
                        {"text": self.text},
                    ],
                }
            }
        }


@pytest.fixture
def stub(monkeypatch):
    s = StubBedrock()
    monkeypatch.setattr(api, "bedrock", lambda: s)
    return s


def test_net_pnl_formula():
    long = {"side": "long", "entry": 100, "exit": 110, "qty": 2, "multiplier": 2, "fees": 2.48}
    short = {"side": "short", "entry": 100, "exit": 110, "qty": 1, "multiplier": 50, "fees": 4.28}
    assert coach.net_pnl(long) == Decimal("37.52")
    assert coach.net_pnl(short) == Decimal("-504.28")


def test_summary_counts_setups_and_mistake_costs():
    trades = [
        trade("a", setup="Breakout", entry=100, exit=110, fees=0),  # +40
        trade("b", setup="Breakout", entry=110, exit=100, fees=0, mistakes=["FOMO entry"]),  # -40
        trade("c", date="2026-10-12", entry=100, exit=100.5, fees=0, mistakes=["FOMO entry"]),  # +2: BE
    ]
    days = [{"date": "2026-10-13", "review": {"text": "x" * 1000, "followedPlan": False, "mood": 2}}]
    s = coach.summarize(trades, days, start="2026-10-01", end="2026-10-13", breakeven_band=5)
    assert s["netPnl"] == 2.0
    assert (s["wins"], s["losses"], s["breakevens"]) == (1, 1, 1)
    assert s["winRatePct"] == 50.0
    assert s["mistakes"] == [{"mistake": "FOMO entry", "trades": 2, "netCost": -38.0}]
    assert s["setups"][0] == {"setup": "Breakout", "trades": 2, "wins": 1, "net": 0.0}
    assert len(s["dayNotes"][0]["review"]) == coach.MAX_REVIEW_CHARS
    assert s["bestDay"]["date"] == "2026-10-12"


def test_summary_caps_at_400_newest():
    trades = [trade(f"t{i:04d}", time=f"{9 + i // 60 % 6:02d}:{i % 60:02d}") for i in range(450)]
    s = coach.summarize(trades, [], start="2026-10-13", end="2026-10-13", breakeven_band=0)
    assert s["tradesAnalyzed"] == 400 and s["tradesInRange"] == 450


def test_coach_calls_bedrock_with_summary(aws, stub):
    call("PUT", "/api/trades/t1", trade("t1", notes="SECRET NOTE"))
    call("PUT", "/api/trades/t2", trade("t2", date="2026-09-01"))  # out of range
    call("PUT", "/api/trades/u1", trade("u1"), sub=USER_B)  # someone else's
    status, body = call("POST", "/api/ai/coach", {"from": "2026-10-07", "to": "2026-10-13"})
    assert status == 200 and body == {"text": "What worked\n..."}
    (req,) = stub.calls
    assert req["modelId"] == "deepseek.v3.2"
    assert req["inferenceConfig"] == {"maxTokens": 600, "temperature": 0.3}
    assert "180 words" in req["system"][0]["text"]
    prompt = req["messages"][0]["content"][0]["text"]
    assert '"tradesAnalyzed":1' in prompt and "SECRET NOTE" not in prompt
    assert "Review this period" in prompt


def test_coach_question(aws, stub):
    call("PUT", "/api/trades/t1", trade("t1"))
    status, _ = call("POST", "/api/ai/coach", {"from": "2026-10-13", "to": "2026-10-13", "question": "Why?"})
    assert status == 200
    assert "My question: Why?" in stub.calls[0]["messages"][0]["content"][0]["text"]


def test_coach_empty_range_skips_bedrock(aws, stub):
    status, body = call("POST", "/api/ai/coach", {"from": "2026-10-01", "to": "2026-10-13"})
    assert status == 200 and "Nothing logged" in body["text"]
    assert stub.calls == []


def test_coach_bedrock_error_is_502(aws, monkeypatch):
    err = ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "Converse")
    monkeypatch.setattr(api, "bedrock", lambda: StubBedrock(error=err))
    call("PUT", "/api/trades/t1", trade("t1"))
    status, body = call("POST", "/api/ai/coach", {"from": "2026-10-13", "to": "2026-10-13"})
    assert status == 502 and "error" in body


@pytest.mark.parametrize(
    "payload",
    [
        {"from": "2026-10-13", "to": "2026-10-01"},
        {"from": "2026-01-01", "to": "2026-10-13"},
        {"from": "2026-10-01"},
        {"from": "2026-10-01", "to": "2026-10-13", "question": "q" * 501},
    ],
)
def test_coach_validation(aws, stub, payload):
    assert call("POST", "/api/ai/coach", payload)[0] == 400
    assert stub.calls == []
