"""Test helpers: moto world (table + GSI `byId`, photo bucket), HTTP API v2 event builder, sample data."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("TABLE_NAME", "tradejournal-test")
os.environ.setdefault("PHOTO_BUCKET", "tradejournal-test-photos")
os.environ.setdefault("COACH_MODEL_ID", "deepseek.v3.2")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "tradejournal-test")

import app as api  # noqa: E402  (env must be set first)

USER_A = "11111111-aaaa-4aaa-8aaa-111111111111"
USER_B = "22222222-bbbb-4bbb-8bbb-222222222222"


@dataclass
class FakeContext:
    function_name: str = "tradejournal-test-api"
    memory_limit_in_mb: int = 512
    invoked_function_arn: str = "arn:aws:lambda:us-east-1:000000000000:function:tradejournal-test-api"
    aws_request_id: str = "req-1"


@pytest.fixture
def aws():
    with mock_aws():
        api.clear_caches()
        boto3.client("dynamodb").create_table(
            TableName=os.environ["TABLE_NAME"],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
                {"AttributeName": "tid", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "byId",
                    "KeySchema": [
                        {"AttributeName": "pk", "KeyType": "HASH"},
                        {"AttributeName": "tid", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "KEYS_ONLY"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        boto3.client("s3").create_bucket(Bucket=os.environ["PHOTO_BUCKET"])
        yield
        api.clear_caches()


def make_event(method: str, path: str, body=None, sub: str | None = USER_A) -> dict:
    authorizer = {"jwt": {"claims": {"sub": sub, "token_use": "access"}, "scopes": None}} if sub else None
    ctx = {
        "accountId": "000000000000",
        "apiId": "api",
        "domainName": "example.cloudfront.net",
        "http": {
            "method": method,
            "path": path,
            "protocol": "HTTP/1.1",
            "sourceIp": "1.2.3.4",
            "userAgent": "t",
        },
        "requestId": "r1",
        "routeKey": "ANY /api/{proxy+}",
        "stage": "$default",
        "time": "13/Oct/2026:00:00:00 +0000",
        "timeEpoch": 0,
    }
    if authorizer:
        ctx["authorizer"] = authorizer
    return {
        "version": "2.0",
        "routeKey": "ANY /api/{proxy+}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"content-type": "application/json"},
        "requestContext": ctx,
        "body": None if body is None else (body if isinstance(body, str) else json.dumps(body)),
        "isBase64Encoded": False,
    }


def call(method: str, path: str, body=None, sub: str | None = USER_A) -> tuple[int, dict]:
    res = api.lambda_handler(make_event(method, path, body, sub), FakeContext())
    return res["statusCode"], json.loads(res["body"]) if res.get("body") else {}


def trade(id_: str = "t1", **over) -> dict:
    base = {
        "id": id_,
        "accountId": None,
        "date": "2026-10-13",
        "time": "09:31",
        "symbol": "MNQZ5",
        "assetType": "futures",
        "side": "long",
        "qty": 2,
        "entry": 21000.25,
        "exit": 21010.25,
        "fees": 2.48,
        "multiplier": 2,
        "source": "manual",
        "createdAt": "2026-10-13T13:31:00.000Z",
        "updatedAt": "2026-10-13T13:31:00.000Z",
    }
    base.update(over)
    return base


def items(sub: str = USER_A) -> list[dict]:
    t = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return t.query(KeyConditionExpression="pk = :p", ExpressionAttributeValues={":p": f"USER#{sub}"})["Items"]
