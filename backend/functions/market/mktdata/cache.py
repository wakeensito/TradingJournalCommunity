"""Shared market cache in the app's DynamoDB table: pk `MARKET`, sk `DAY#…` / `BARS#…` / `FF#…`.

Market data is not user data, so one cached row serves every user. Values are stored as one compact JSON
string (`data`) so floats never become Decimals and the 400 KB item cap is easy to check. Rows with a `ttl`
are expired by DynamoDB TTL lazily, so reads also treat `ttl <= now` as a miss. Cache failures are never
fatal: a broken cache just means a fresh fetch.
"""

from __future__ import annotations

import json
import os
from typing import Any

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import BotoCoreError, ClientError

from mktdata import clock

PK = "MARKET"
MAX_DATA_BYTES = 350_000  # DynamoDB items cap at 400 KB; leave room for keys/attributes
logger = Logger(child=True)
_table = None


def table():
    global _table
    if _table is None:
        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
        _table = boto3.resource("dynamodb", region_name=region).Table(os.environ["TABLE_NAME"])
    return _table


def get(sk: str) -> Any | None:
    try:
        item = table().get_item(Key={"pk": PK, "sk": sk}).get("Item")
    except (ClientError, BotoCoreError) as err:
        logger.warning("market cache read failed", extra={"sk": sk, "err": type(err).__name__})
        return None
    if not item:
        return None
    ttl = item.get("ttl")
    if ttl is not None and int(ttl) <= clock.epoch():
        return None
    try:
        return json.loads(item["data"])
    except (KeyError, TypeError, ValueError):
        return None


def put(sk: str, value: Any, ttl_seconds: int | None = None) -> bool:
    """`ttl_seconds=None` caches forever. Returns False (and skips) when the value is too large."""
    data = json.dumps(value, separators=(",", ":"))
    if len(data.encode()) > MAX_DATA_BYTES:
        logger.warning("market value too large to cache", extra={"sk": sk, "bytes": len(data)})
        return False
    item: dict[str, Any] = {"pk": PK, "sk": sk, "data": data, "fetchedAt": clock.epoch()}
    if ttl_seconds is not None:
        item["ttl"] = clock.epoch() + int(ttl_seconds)
    try:
        table().put_item(Item=item)
    except (ClientError, BotoCoreError) as err:
        logger.warning("market cache write failed", extra={"sk": sk, "err": type(err).__name__})
        return False
    return True


def reset() -> None:
    global _table
    _table = None
