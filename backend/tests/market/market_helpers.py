"""Market test helpers: moto DynamoDB + SSM, a frozen ET clock, fake yfinance and a fake HTTP session.

No test touches the network: every provider call is served from `fixtures/` or an in-test registry.
The market app is loaded as `market_app` (the API function also has an `app.py`).
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("TABLE_NAME", "tradejournal-test")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "tradejournal-market-test")
os.environ["FMP_KEY_PARAM"] = "clearvest-fmp"

MARKET_DIR = Path(__file__).resolve().parents[2] / "functions" / "market"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
if str(MARKET_DIR) not in sys.path:
    sys.path.append(str(MARKET_DIR))  # append: the API function's `app` must keep winning `import app`


def _load_market_app():
    if "market_app" in sys.modules:
        return sys.modules["market_app"]
    spec = importlib.util.spec_from_file_location("market_app", MARKET_DIR / "app.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["market_app"] = mod
    spec.loader.exec_module(mod)
    return mod


market_app = _load_market_app()

from mktdata import clock, http, yahoo  # noqa: E402

NY = clock.NY
USER = "11111111-aaaa-4aaa-8aaa-111111111111"
# Tuesday 2026-10-13, 15:00 ET (19:00 UTC).
FROZEN_NOW = dt.datetime(2026, 10, 13, 19, 0, tzinfo=dt.UTC)


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text()


# ── fake yfinance ──────────────────────────────────────────────────────
class FakeFrame:
    def __init__(self, rows: list[tuple[dt.datetime, dict]]):
        self._rows = rows

    @property
    def empty(self) -> bool:
        return not self._rows

    def iterrows(self):
        return iter(self._rows)


def daily_frame(closes: dict[str, float]) -> FakeFrame:
    return FakeFrame(
        [(dt.datetime.fromisoformat(d).replace(tzinfo=NY), {"Close": c}) for d, c in sorted(closes.items())]
    )


def intraday_frame(day: dt.date, start: str, count: int, step_min: int, base: float = 100.0) -> FakeFrame:
    t0 = dt.datetime.combine(day, dt.time.fromisoformat(start), NY)
    rows = []
    for i in range(count):
        p = base + i * 0.25
        rows.append(
            (
                t0 + dt.timedelta(minutes=i * step_min),
                {"Open": p, "High": p + 0.5, "Low": p - 0.5, "Close": p + 0.25, "Volume": 100 + i},
            )
        )
    return FakeFrame(rows)


class FakeYF:
    def __init__(self):
        self.registry: dict[tuple[str, str], object] = {}
        self.calls: list[tuple[str, dict]] = []

    def set_tz_cache_location(self, _path):
        pass

    def Ticker(self, symbol):  # noqa: N802 - mirrors yfinance
        yf = self

        class _T:
            def history(self, **kw):
                yf.calls.append((symbol, kw))
                got = yf.registry.get((symbol, kw["interval"]), FakeFrame([]))
                if isinstance(got, Exception):
                    raise got
                return got

        return _T()


# ── fake HTTP ──────────────────────────────────────────────────────────
class FakeResponse:
    def __init__(self, status: int, text: str):
        self.status_code = status
        self.text = text

    def json(self):
        return json.loads(self.text)


class FakeSession:
    """routes: url → (status, text) | Exception | callable(params) → (status, text)."""

    def __init__(self):
        self.routes: dict[str, object] = {}
        self.calls: list[tuple[str, dict]] = []

    def request(self, method, url, timeout=None, params=None, **_kw):
        self.calls.append((url, dict(params or {})))
        route = self.routes.get(url)
        if route is None:
            raise AssertionError(f"unexpected network call to {url}")
        if isinstance(route, Exception):
            raise route
        if callable(route):
            route = route(params or {})
        status, text = route
        return FakeResponse(status, text)

    def urls(self) -> list[str]:
        return [u for u, _ in self.calls]


@pytest.fixture
def world(monkeypatch):
    """moto table + SSM key, frozen clock, fake yfinance + HTTP. Yields a namespace of fakes."""
    with mock_aws():
        market_app.clear_caches()
        boto3.client("dynamodb").create_table(
            TableName=os.environ["TABLE_NAME"],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        boto3.client("ssm").put_parameter(Name="clearvest-fmp", Value="test-fmp-key", Type="SecureString")
        fake_yf = FakeYF()
        session = FakeSession()
        monkeypatch.setattr(clock, "now", lambda: FROZEN_NOW)
        monkeypatch.setattr(yahoo, "_yf", lambda: fake_yf)
        monkeypatch.setattr(http, "_session", session)

        class W:
            yf = fake_yf
            http = session

            @staticmethod
            def set_now(when: dt.datetime):
                monkeypatch.setattr(clock, "now", lambda: when)

        yield W
        market_app.clear_caches()


# ── HTTP API v2 events ─────────────────────────────────────────────────
class FakeContext:
    function_name = "tradejournal-test-market"
    memory_limit_in_mb = 512
    invoked_function_arn = "arn:aws:lambda:us-east-1:000000000000:function:tradejournal-test-market"
    aws_request_id = "req-1"


def call(path: str, query: dict | None = None, sub: str | None = USER) -> tuple[int, dict]:
    from urllib.parse import urlencode

    ctx = {
        "accountId": "000000000000",
        "apiId": "api",
        "domainName": "example.cloudfront.net",
        "http": {
            "method": "GET",
            "path": path,
            "protocol": "HTTP/1.1",
            "sourceIp": "1.2.3.4",
            "userAgent": "t",
        },
        "requestId": "r1",
        "routeKey": "ANY /api/market/{proxy+}",
        "stage": "$default",
        "time": "13/Oct/2026:00:00:00 +0000",
        "timeEpoch": 0,
    }
    if sub:
        ctx["authorizer"] = {"jwt": {"claims": {"sub": sub, "token_use": "access"}, "scopes": None}}
    event = {
        "version": "2.0",
        "routeKey": "ANY /api/market/{proxy+}",
        "rawPath": path,
        "rawQueryString": urlencode(query or {}),
        "queryStringParameters": query or None,
        "headers": {},
        "requestContext": ctx,
        "isBase64Encoded": False,
    }
    res = market_app.lambda_handler(event, FakeContext())
    return res["statusCode"], json.loads(res["body"]) if res.get("body") else {}


def market_item(sk: str) -> dict | None:
    t = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return t.get_item(Key={"pk": "MARKET", "sk": sk}).get("Item")
