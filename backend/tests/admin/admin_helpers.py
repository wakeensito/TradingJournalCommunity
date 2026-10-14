"""Admin test helpers: moto Cognito (pool + `admin` group) + DynamoDB + S3, and an HTTP API v2 event builder.

The admin app is loaded as `admin_app` (the API function also has an `app.py`).
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("TABLE_NAME", "tradejournal-test")
os.environ.setdefault("PHOTO_BUCKET", "tradejournal-test-photos")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "tradejournal-admin-test")

ADMIN_DIR = Path(__file__).resolve().parents[2] / "functions" / "admin"


def _load_admin_app():
    if "admin_app" in sys.modules:
        return sys.modules["admin_app"]
    spec = importlib.util.spec_from_file_location("admin_app", ADMIN_DIR / "app.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["admin_app"] = mod
    spec.loader.exec_module(mod)
    return mod


admin_app = _load_admin_app()


@dataclass
class FakeContext:
    function_name: str = "tradejournal-test-admin"
    memory_limit_in_mb: int = 512
    invoked_function_arn: str = "arn:aws:lambda:us-east-1:000000000000:function:tradejournal-test-admin"
    aws_request_id: str = "req-1"


@dataclass
class Person:
    username: str
    sub: str
    email: str


class World:
    def __init__(self):
        self.idp = boto3.client("cognito-idp")
        self.pool = self.idp.create_user_pool(
            PoolName="tradejournal-test-users",
            UsernameAttributes=["email"],
            # Mirrors template.yaml: no symbol required (moto's default policy demands one).
            Policies={
                "PasswordPolicy": {
                    "MinimumLength": 8,
                    "RequireUppercase": True,
                    "RequireLowercase": True,
                    "RequireNumbers": True,
                    "RequireSymbols": False,
                }
            },
        )["UserPool"]["Id"]
        os.environ["USER_POOL_ID"] = self.pool
        self.idp.create_group(UserPoolId=self.pool, GroupName="admin")
        self.table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
        self.s3 = boto3.client("s3")

    def person(self, email: str, admin: bool = False) -> Person:
        u = self.idp.admin_create_user(
            UserPoolId=self.pool,
            Username=email,
            UserAttributes=[{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"}],
            TemporaryPassword="Temp1234abcd",
            MessageAction="SUPPRESS",
        )["User"]
        attrs = {a["Name"]: a["Value"] for a in u["Attributes"]}
        if admin:
            self.idp.admin_add_user_to_group(UserPoolId=self.pool, Username=u["Username"], GroupName="admin")
        return Person(u["Username"], attrs["sub"], email)

    def confirm(self, p: Person) -> None:
        self.idp.admin_set_user_password(
            UserPoolId=self.pool, Username=p.username, Password="Perm1234abcd", Permanent=True
        )

    def get(self, p: Person) -> dict:
        return self.idp.admin_get_user(UserPoolId=self.pool, Username=p.username)

    def admins(self) -> set[str]:
        users = self.idp.list_users_in_group(UserPoolId=self.pool, GroupName="admin")["Users"]
        return {u["Username"] for u in users}

    def seed_data(self, p: Person, n: int = 3) -> None:
        for i in range(n):
            self.table.put_item(Item={"pk": f"USER#{p.sub}", "sk": f"TRADE#2026-10-13#t{i}", "tid": f"t{i}"})
        self.table.put_item(Item={"pk": f"USER#{p.sub}", "sk": "SETTINGS"})
        for i in range(2):
            self.s3.put_object(
                Bucket=os.environ["PHOTO_BUCKET"], Key=f"users/{p.sub}/trades/t{i}/p.jpg", Body=b"x"
            )

    def item_count(self, p: Person) -> int:
        return len(
            self.table.query(
                KeyConditionExpression="pk = :p", ExpressionAttributeValues={":p": f"USER#{p.sub}"}
            )["Items"]
        )

    def photo_count(self, p: Person) -> int:
        r = self.s3.list_objects_v2(Bucket=os.environ["PHOTO_BUCKET"], Prefix=f"users/{p.sub}/")
        return r.get("KeyCount", 0)


@pytest.fixture
def world():
    with mock_aws():
        admin_app.clear_caches()
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
        boto3.client("s3").create_bucket(Bucket=os.environ["PHOTO_BUCKET"])
        yield World()
        admin_app.clear_caches()


def make_event(
    method: str, path: str, caller: Person | None, groups="[admin]", body=None, query: str = ""
) -> dict:
    claims = None
    if caller:
        claims = {"sub": caller.sub, "username": caller.username, "token_use": "access"}
        if groups is not None:
            claims["cognito:groups"] = groups
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
        "routeKey": f"{method} {path}",
        "stage": "$default",
        "time": "13/Oct/2026:00:00:00 +0000",
        "timeEpoch": 0,
    }
    if claims:
        ctx["authorizer"] = {"jwt": {"claims": claims, "scopes": None}}
    params = dict(kv.split("=", 1) for kv in query.split("&")) if query else None
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": query,
        "queryStringParameters": params,
        "headers": {"content-type": "application/json"},
        "requestContext": ctx,
        "body": None if body is None else json.dumps(body),
        "isBase64Encoded": False,
    }


def call(method: str, path: str, caller: Person | None, groups="[admin]", body=None, query: str = ""):
    res = admin_app.lambda_handler(make_event(method, path, caller, groups, body, query), FakeContext())
    return res["statusCode"], json.loads(res["body"]) if res.get("body") else {}
