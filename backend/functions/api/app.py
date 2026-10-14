"""api Lambda — the trade journal API behind the HTTP API Cognito JWT authorizer.

Contract: docs/superpowers/specs/2026-10-13-v2-simple-journal-on-aws-design.md ("API" + "Data model").
Every item lives under `pk = USER#<sub>`, where `sub` comes from the verified JWT claims, so a caller can
only ever address their own partition. Never log trade contents (notes, prices, symbols).
"""

from __future__ import annotations

import datetime as dt
import functools
import json
import os
import uuid

import boto3
import coach
import validation as v
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

logger = Logger()

MAX_BATCH = 500
MAX_COMBINE_SOURCES = 99  # TransactWriteItems caps at 100 actions: 1 put + 99 deletes
MAX_VIEW_KEYS = 100
MAX_COACH_DAYS = 92
MAX_QUESTION = 500
MAX_PHOTO_BYTES = 8 * 1024 * 1024
UPLOAD_TTL_S = 300
VIEW_TTL_S = 3600
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _dumps(obj) -> str:
    return json.dumps(v.from_dynamo(obj), separators=(",", ":"))


app = APIGatewayHttpResolver(strip_prefixes=["/api"], serializer=_dumps)


def _error(status: int, message: str) -> Response:
    return Response(status_code=status, content_type="application/json", body=_dumps({"error": message}))


@app.exception_handler(ApiError)
def _api_error(err: ApiError):
    return _error(err.status, err.message)


@app.exception_handler(v.ValidationError)
def _validation_error(err: v.ValidationError):
    return _error(400, str(err))


@app.not_found
def _not_found(_exc):
    return _error(404, "Not found")


@app.exception_handler(Exception)
def _unexpected(_err: Exception):
    logger.exception("unhandled error")
    return _error(500, "Something went wrong on our side. Please try again.")


# ── AWS clients (cached per container; tests clear the caches) ─────────
def _region() -> str:
    return os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"


@functools.cache
def table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


@functools.cache
def s3():
    # Regional virtual-hosted endpoint so presigned URLs are https://<bucket>.s3.<region>.amazonaws.com/…,
    # which is exactly what the CloudFront CSP allows (connect-src / img-src).
    region = _region()
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=f"https://s3.{region}.amazonaws.com",
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


@functools.cache
def bedrock():
    return boto3.client(
        "bedrock-runtime",
        config=Config(read_timeout=25, connect_timeout=5, retries={"max_attempts": 2, "mode": "standard"}),
    )


def clear_caches() -> None:
    table.cache_clear()
    s3.cache_clear()
    bedrock.cache_clear()


# ── request helpers ─────────────────────────────────────────────────────
def caller() -> str:
    claims = (
        ((app.current_event.raw_event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}
    ).get("claims") or {}
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ApiError(401, "Please sign in.")
    return sub


def body() -> dict:
    raw = app.current_event.decoded_body
    if raw in (None, ""):
        raise ApiError(400, "Request body is required")
    try:
        data = json.loads(raw)
    except (TypeError, ValueError) as exc:
        raise ApiError(400, "Request body must be JSON") from exc
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object")
    return data


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def pk(sub: str) -> str:
    return f"USER#{sub}"


def trade_sk(date: str, trade_id: str) -> str:
    return f"TRADE#{date}#{trade_id}"


STRIP = {"pk", "sk", "tid"}


def clean(item: dict) -> dict:
    return {k: val for k, val in item.items() if k not in STRIP}


def _query_all(**kwargs) -> list[dict]:
    items: list[dict] = []
    while True:
        page = table().query(**kwargs)
        items.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return items
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _find_trade_keys(sub: str, trade_id: str) -> list[str]:
    """Sort keys of every item with this trade id (GSI `byId`; normally 0 or 1)."""
    items = _query_all(
        IndexName="byId",
        KeyConditionExpression=Key("pk").eq(pk(sub)) & Key("tid").eq(trade_id),
    )
    return [i["sk"] for i in items]


def _trade_index(sub: str) -> dict[str, list[dict]]:
    """id → [{sk, createdAt, photoKeys}] for all of the caller's trades (one consistent, keys-only query)."""
    items = _query_all(
        KeyConditionExpression=Key("pk").eq(pk(sub)) & Key("sk").begins_with("TRADE#"),
        ProjectionExpression="#sk, #tid, #c",
        ExpressionAttributeNames={"#sk": "sk", "#tid": "tid", "#c": "createdAt"},
        ConsistentRead=True,
    )
    index: dict[str, list[dict]] = {}
    for item in items:
        index.setdefault(item.get("tid", ""), []).append(item)
    return index


def _trade_item(sub: str, trade: dict, created_at: str | None) -> dict:
    now = _now()
    item = dict(trade)
    item["createdAt"] = created_at or trade.get("createdAt") or now
    item["updatedAt"] = now
    item.update(pk=pk(sub), sk=trade_sk(trade["date"], trade["id"]), tid=trade["id"])
    return item


def _delete_photos(keys: list[str]) -> None:
    if not keys:
        return
    try:
        s3().delete_objects(
            Bucket=os.environ["PHOTO_BUCKET"],
            Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
        )
    except (ClientError, BotoCoreError):
        # The trade is already gone; orphaned photos are only storage, never visible to anyone.
        logger.exception("photo cleanup failed", extra={"count": len(keys)})


# ── routes ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/bootstrap")
def bootstrap():
    sub = caller()
    items = _query_all(KeyConditionExpression=Key("pk").eq(pk(sub)))
    settings = v.default_settings()
    accounts, trades, days = [], [], []
    for item in items:
        sk = item["sk"]
        if sk.startswith("TRADE#"):
            trades.append(clean(item))
        elif sk.startswith("ACCOUNT#"):
            accounts.append(clean(item))
        elif sk.startswith("DAY#"):
            days.append(clean(item))
        elif sk == "SETTINGS":
            settings.update(clean(item))
    logger.info("bootstrap", extra={"trades": len(trades), "accounts": len(accounts), "days": len(days)})
    return {"settings": settings, "accounts": accounts, "trades": trades, "days": days}


@app.put("/trades/<trade_id>")
def put_trade(trade_id: str):
    sub = caller()
    trade = v.trade(body(), sub, trade_id)
    new_sk = trade_sk(trade["date"], trade["id"])
    old_sks = _find_trade_keys(sub, trade["id"])

    created_at = None
    for sk in old_sks:
        old = table().get_item(Key={"pk": pk(sub), "sk": sk}, ProjectionExpression="createdAt").get("Item")
        if old and old.get("createdAt"):
            created_at = old["createdAt"]
            break
    item = _trade_item(sub, trade, created_at)

    stale = [sk for sk in old_sks if sk != new_sk]
    if not stale:
        table().put_item(Item=item)
    else:
        # Date changed → the sort key moves: delete old + put new atomically.
        client = table().meta.client
        name = table().name
        actions = [{"Delete": {"TableName": name, "Key": {"pk": pk(sub), "sk": sk}}} for sk in stale]
        actions.append({"Put": {"TableName": name, "Item": item}})
        client.transact_write_items(TransactItems=actions)
    logger.info("trade saved", extra={"moved": bool(stale)})
    return clean(item)


@app.delete("/trades/<trade_id>")
def delete_trade(trade_id: str):
    sub = caller()
    v.ident(trade_id)
    # Idempotent: deleting an id the caller doesn't have (already gone, or someone else's) is a no-op,
    # so offline retries never error. Keys are always under the caller's own pk.
    sks = _find_trade_keys(sub, trade_id)
    photo_keys: list[str] = []
    for sk in sks:
        old = table().delete_item(Key={"pk": pk(sub), "sk": sk}, ReturnValues="ALL_OLD").get("Attributes")
        if old:
            photo_keys.extend(k for k in old.get("photoKeys", []) if k.startswith(f"users/{sub}/"))
    _delete_photos(sorted(set(photo_keys)))
    logger.info("trade deleted", extra={"photos": len(photo_keys)})
    return {"deleted": True}


@app.post("/trades/batch")
def batch_trades():
    sub = caller()
    raw = body().get("trades")
    if not isinstance(raw, list):
        raise ApiError(400, "trades must be a list")
    if len(raw) > MAX_BATCH:
        raise ApiError(400, f"At most {MAX_BATCH} trades per batch")
    by_id: dict[str, dict] = {}
    for i, t in enumerate(raw):
        try:
            trade = v.trade(t, sub)
        except v.ValidationError as exc:
            raise ApiError(400, f"trades[{i}]: {exc}") from exc
        by_id[trade["id"]] = trade  # same id twice in one batch → last one wins

    index = _trade_index(sub) if by_id else {}
    with table().batch_writer(overwrite_by_pkeys=["pk", "sk"]) as writer:
        for trade in by_id.values():
            existing = index.get(trade["id"], [])
            created_at = next((e["createdAt"] for e in existing if e.get("createdAt")), None)
            item = _trade_item(sub, trade, created_at)
            for e in existing:
                if e["sk"] != item["sk"]:
                    writer.delete_item(Key={"pk": pk(sub), "sk": e["sk"]})
            writer.put_item(Item=item)
    logger.info("batch written", extra={"count": len(by_id)})
    return {"written": len(by_id)}


@app.post("/trades/combine")
def combine_trades():
    sub = caller()
    data = body()
    source_ids = data.get("sourceIds")
    if not isinstance(source_ids, list) or not source_ids:
        raise ApiError(400, "sourceIds must be a non-empty list")
    source_ids = list(dict.fromkeys(v.ident(s, "sourceIds[]") for s in source_ids))
    if len(source_ids) > MAX_COMBINE_SOURCES:
        raise ApiError(400, f"At most {MAX_COMBINE_SOURCES} trades can be combined at once")
    merged = v.trade(data.get("merged"), sub)

    index = _trade_index(sub)
    missing = [s for s in source_ids if s not in index]
    if missing:
        raise ApiError(404, "One or more trades to combine were not found")

    sources = [e for s in source_ids for e in index[s]]
    created_at = min((e["createdAt"] for e in sources if e.get("createdAt")), default=None)
    item = _trade_item(sub, merged, created_at)

    # Delete every source plus any older copy of the merged id, except the key the put overwrites.
    to_delete = {e["sk"] for e in sources} | {e["sk"] for e in index.get(merged["id"], [])}
    to_delete.discard(item["sk"])
    if len(to_delete) + 1 > 100:
        raise ApiError(400, f"At most {MAX_COMBINE_SOURCES} trades can be combined at once")

    name = table().name
    actions: list[dict] = [{"Put": {"TableName": name, "Item": item}}]
    actions += [
        {
            "Delete": {
                "TableName": name,
                "Key": {"pk": pk(sub), "sk": sk},
                "ConditionExpression": "attribute_exists(pk)",
            }
        }
        for sk in sorted(to_delete)
    ]
    try:
        table().meta.client.transact_write_items(TransactItems=actions)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            raise ApiError(409, "Trades changed while combining. Refresh and try again.") from exc
        raise
    logger.info("trades combined", extra={"sources": len(source_ids)})
    return clean(item)


@app.put("/days/<day>")
def put_day(day: str):
    sub = caller()
    note = v.day_note(body(), day)
    note["updatedAt"] = _now()
    table().put_item(Item={**note, "pk": pk(sub), "sk": f"DAY#{note['date']}"})
    return note


@app.put("/accounts/<account_id>")
def put_account(account_id: str):
    sub = caller()
    account = v.account(body(), account_id)
    key = {"pk": pk(sub), "sk": f"ACCOUNT#{account['id']}"}
    old = table().get_item(Key=key, ProjectionExpression="createdAt").get("Item") or {}
    account["createdAt"] = old.get("createdAt") or account.get("createdAt") or _now()
    table().put_item(Item={**account, **key})
    return account


@app.delete("/accounts/<account_id>")
def delete_account(account_id: str):
    sub = caller()
    v.ident(account_id)
    table().delete_item(Key={"pk": pk(sub), "sk": f"ACCOUNT#{account_id}"})  # idempotent
    return {"deleted": True}


@app.put("/settings")
def put_settings():
    sub = caller()
    key = {"pk": pk(sub), "sk": "SETTINGS"}
    current = v.default_settings()
    stored = table().get_item(Key=key).get("Item")
    if stored:
        current.update(clean(stored))
    settings = v.settings(body(), current)
    table().put_item(Item={**v.to_dynamo(settings), **key})
    return settings


@app.post("/photos/upload-url")
def photo_upload_url():
    sub = caller()
    data = body()
    trade_id = v.ident(data.get("tradeId"), "tradeId")
    content_type = data.get("contentType")
    if content_type not in PHOTO_TYPES:
        raise ApiError(400, "contentType must be image/jpeg, image/png or image/webp")
    key = f"users/{sub}/trades/{trade_id}/{uuid.uuid4()}.{PHOTO_TYPES[content_type]}"
    params = {"Bucket": os.environ["PHOTO_BUCKET"], "Key": key, "ContentType": content_type}
    # Required: the size is signed into the URL, so S3 rejects any other length —
    # this is what enforces the cap.
    size = data.get("size")
    if isinstance(size, bool) or not isinstance(size, int) or not 0 < size <= MAX_PHOTO_BYTES:
        raise ApiError(400, "Photos must be 8 MB or smaller (send the file size)")
    params["ContentLength"] = size
    url = s3().generate_presigned_url("put_object", Params=params, ExpiresIn=UPLOAD_TTL_S)
    return {"key": key, "url": url}


@app.post("/photos/view-urls")
def photo_view_urls():
    sub = caller()
    keys = body().get("keys")
    if not isinstance(keys, list):
        raise ApiError(400, "keys must be a list")
    if len(keys) > MAX_VIEW_KEYS:
        raise ApiError(400, f"At most {MAX_VIEW_KEYS} keys per request")
    keys = [v.photo_key(k, sub) for k in keys]
    bucket = os.environ["PHOTO_BUCKET"]
    urls = {
        k: s3().generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": k}, ExpiresIn=VIEW_TTL_S
        )
        for k in dict.fromkeys(keys)
    }
    return {"urls": urls}


@app.post("/ai/coach")
def ai_coach():
    sub = caller()
    data = body()
    start = v.date(data.get("from"), "from")
    end = v.date(data.get("to"), "to")
    span = (dt.date.fromisoformat(end) - dt.date.fromisoformat(start)).days + 1
    if span < 1:
        raise ApiError(400, "from must be on or before to")
    if span > MAX_COACH_DAYS:
        raise ApiError(400, f"Pick a range of at most {MAX_COACH_DAYS} days")
    question = data.get("question")
    if question is not None:
        question = v.string(question, "question", max_len=MAX_QUESTION, min_len=0) or None

    trades = _query_all(
        KeyConditionExpression=Key("pk").eq(pk(sub))
        & Key("sk").between(f"TRADE#{start}#", f"TRADE#{end}#\uffff"),
    )
    days = _query_all(
        KeyConditionExpression=Key("pk").eq(pk(sub)) & Key("sk").between(f"DAY#{start}", f"DAY#{end}"),
    )
    stored = table().get_item(Key={"pk": pk(sub), "sk": "SETTINGS"}).get("Item") or {}
    band = stored.get("breakevenBand", v.DEFAULT_SETTINGS["breakevenBand"])

    if not trades and not days:
        return {"text": f"Nothing logged between {start} and {end} yet. Log a few trades and try again."}

    summary = coach.summarize(trades, days, start=start, end=end, breakeven_band=band)
    model_id = os.environ.get("COACH_MODEL_ID", "deepseek.v3.2")
    try:
        text = coach.converse(bedrock(), model_id, summary, question)
    except (ClientError, BotoCoreError) as exc:
        logger.warning("coach model call failed", extra={"error": type(exc).__name__})
        raise ApiError(502, "The coach is unavailable right now. Try again in a minute.") from exc
    if not text:
        raise ApiError(502, "The coach returned an empty answer. Try again.")
    logger.info("coach answered", extra={"trades": summary["tradesAnalyzed"], "question": bool(question)})
    return {"text": text}


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
def lambda_handler(event, context):
    return app.resolve(event, context)
