"""admin Lambda — in-app user management for the journal's admins (Cognito group `admin`).

Routes (behind the HTTP API Cognito JWT authorizer; every one also requires `admin` in `cognito:groups`):
  GET    /api/admin/users                              → [AdminUser]
  POST   /api/admin/users          {email, admin?}      → {user, temporaryPassword}  (Cognito emails it)
  POST   /api/admin/users/{username}/disable | /enable  → {user}
  POST   /api/admin/users/{username}/reset-password     → {user, temporaryPassword}
  POST   /api/admin/users/{username}/resend             → {user, temporaryPassword}   (invited users only)
  POST   /api/admin/users/{username}/admin  {admin}     → {user}
  DELETE /api/admin/users/{username}?purge=true         → {deleted, purged: {items, photos}}

Authorization is checked twice: the JWT `cognito:groups` claim (cheap, rejects most callers), then LIVE
against Cognito: the caller must still be an enabled member of `admin` right now. A token keeps its groups
claim for up to an hour after a demotion or disable, so the claim alone is stale privilege.

Guardrails: an admin can't disable, delete, demote or admin-reset themselves, and the last admin can never be
removed or demoted (checked before the change, and re-checked after it so concurrent admin-on-admin requests
can't leave zero admins; see `_ensure_admin_left`). Separate from the journal API on purpose: only this
function's role holds Cognito admin rights.
Never log emails, usernames or passwords — counts and action names only.
"""

from __future__ import annotations

import functools
import json
import os
import re
import secrets
from urllib.parse import unquote

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger = Logger()

ADMIN_GROUP = "admin"
TEMP_PASSWORD_LEN = 16
# No look-alikes (0/O, 1/l/I) so a temp password read aloud or retyped from a screenshot survives.
_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_LOWER = "abcdefghijkmnpqrstuvwxyz"
_DIGITS = "23456789"
_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
_USERNAME_RE = re.compile(r"^[\w.@+-]{1,128}$")
_SUB_RE = re.compile(r"^[0-9a-fA-F-]{8,64}$")


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _dumps(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), default=str)


app = APIGatewayHttpResolver(strip_prefixes=["/api"], serializer=_dumps)


def _error(status: int, message: str) -> Response:
    return Response(status_code=status, content_type="application/json", body=_dumps({"error": message}))


@app.exception_handler(ApiError)
def _api_error(err: ApiError):
    return _error(err.status, err.message)


# Cognito errors the admin can act on; anything else is a 500 (logged without user data).
_COGNITO_ERRORS = {
    "UserNotFoundException": (404, "That user no longer exists."),
    "UsernameExistsException": (409, "That email already has an account."),
    "InvalidPasswordException": (400, "That password doesn't meet the pool's rules."),
    "InvalidParameterException": (400, "Check the email address and try again."),
    "LimitExceededException": (429, "Too many requests. Wait a few minutes and try again."),
    "TooManyRequestsException": (429, "Too many requests. Wait a minute and try again."),
    "CodeDeliveryFailureException": (
        502,
        "Cognito couldn't send the invite email. Share the password directly.",
    ),
}


@app.exception_handler(ClientError)
def _client_error(err: ClientError):
    code = err.response.get("Error", {}).get("Code", "")
    if code in _COGNITO_ERRORS:
        return _error(*_COGNITO_ERRORS[code])
    logger.exception("aws error", extra={"code": code})
    return _error(500, "Something went wrong on our side. Please try again.")


@app.not_found
def _not_found(_exc):
    return _error(404, "Not found")


@app.exception_handler(Exception)
def _unexpected(_err: Exception):
    logger.exception("unhandled error")
    return _error(500, "Something went wrong on our side. Please try again.")


# ── AWS clients (cached per container; tests clear the caches) ─────────
@functools.cache
def cognito():
    return boto3.client("cognito-idp")


@functools.cache
def table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


@functools.cache
def s3():
    return boto3.client("s3")


def clear_caches() -> None:
    cognito.cache_clear()
    table.cache_clear()
    s3.cache_clear()


def pool() -> str:
    return os.environ["USER_POOL_ID"]


# ── request helpers ─────────────────────────────────────────────────────
def _claims() -> dict:
    return (
        ((app.current_event.raw_event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}
    ).get("claims") or {}


def parse_groups(raw) -> list[str]:
    """`cognito:groups` as a list, or (HTTP API JWT claims) a string: "[admin]", "[a b]" or '["a","b"]'."""
    if isinstance(raw, list):
        return [str(g) for g in raw if g]
    if not isinstance(raw, str) or not raw.strip():
        return []
    text = raw.strip()
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(g) for g in parsed if g]
        except ValueError:
            pass
        text = text[1:-1]
    return [g.strip().strip('"') for g in re.split(r"[\s,]+", text) if g.strip().strip('"')]


def require_admin() -> dict:
    """The caller's claims, after checking they're signed in and in the admin group."""
    claims = _claims()
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ApiError(401, "Please sign in.")
    if ADMIN_GROUP not in parse_groups(claims.get("cognito:groups")):
        raise ApiError(403, "Only admins can manage people.")
    # Live re-check: one ListUsersInGroup read (the group is tiny) answers both "still in `admin`?" and
    # "still enabled?", with no new IAM action (so no deploy-ordering gap). Matched on `sub` (immutable,
    # unique), not the username claim. A user demoted, disabled or deleted after their token was minted
    # fails here although the claim still says admin.
    me = next((u for u in _admin_members() if _attrs(u.get("Attributes")).get("sub") == sub), None)
    if me is None or not me.get("Enabled", True):
        logger.info("stale admin claim rejected")
        raise ApiError(403, "Your admin access has changed. Sign out and back in.")
    return claims


def body() -> dict:
    raw = app.current_event.decoded_body
    if raw in (None, ""):
        return {}
    try:
        data = json.loads(raw)
    except (TypeError, ValueError) as exc:
        raise ApiError(400, "Request body must be JSON") from exc
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object")
    return data


def valid_username(raw: str) -> str:
    username = unquote(raw or "")
    if not _USERNAME_RE.match(username):
        raise ApiError(400, "That isn't a valid user id.")
    return username


def valid_email(raw) -> str:
    if not isinstance(raw, str):
        raise ApiError(400, "Enter an email address.")
    email = raw.strip().lower()
    if len(email) > 254 or not _EMAIL_RE.match(email):
        raise ApiError(400, "Enter a valid email address.")
    return email


def temp_password() -> str:
    """CSPRNG password meeting the pool policy (≥ 8, upper, lower, digit)."""
    rng = secrets.SystemRandom()
    chars = [secrets.choice(_UPPER), secrets.choice(_LOWER), secrets.choice(_DIGITS)]
    alphabet = _UPPER + _LOWER + _DIGITS
    chars += [secrets.choice(alphabet) for _ in range(TEMP_PASSWORD_LEN - len(chars))]
    rng.shuffle(chars)
    return "".join(chars)


# ── Cognito helpers ─────────────────────────────────────────────────────
def _attrs(raw: list[dict] | None) -> dict[str, str]:
    return {a["Name"]: a.get("Value", "") for a in raw or []}


def _iso(value) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else None)


def _shape(user: dict, admins: set[str], caller_sub: str) -> dict:
    """Cognito user (ListUsers shape, or AdminGetUser normalized by _get_user) → AdminUser."""
    attrs = _attrs(user.get("Attributes"))
    username = user["Username"]
    return {
        "username": username,
        "email": attrs.get("email", ""),
        "status": user.get("UserStatus", "UNKNOWN"),
        "enabled": bool(user.get("Enabled", True)),
        "createdAt": _iso(user.get("UserCreateDate")),
        "lastModified": _iso(user.get("UserLastModifiedDate")),
        "isAdmin": username in admins,
        "isSelf": bool(caller_sub) and attrs.get("sub") == caller_sub,
    }


def _admin_members() -> list[dict]:
    """Every user in the `admin` group (ListUsers shape: Username / Attributes / Enabled), read live."""
    users: list[dict] = []
    kwargs = {"UserPoolId": pool(), "GroupName": ADMIN_GROUP, "Limit": 60}
    while True:
        try:
            page = cognito().list_users_in_group(**kwargs)
        except ClientError as err:
            if err.response.get("Error", {}).get("Code") == "ResourceNotFoundException":
                return users  # group not created yet
            raise
        users.extend(page.get("Users", []))
        token = page.get("NextToken")
        if not token:
            return users
        kwargs["NextToken"] = token


def _admin_usernames(*, enabled_only: bool = False) -> set[str]:
    return {u["Username"] for u in _admin_members() if not enabled_only or u.get("Enabled", True)}


def _get_user(username: str) -> dict:
    """AdminGetUser, normalized to the ListUsers shape (Attributes / Enabled / dates)."""
    r = cognito().admin_get_user(UserPoolId=pool(), Username=username)
    return {
        "Username": r["Username"],
        "Attributes": r.get("UserAttributes", []),
        "UserStatus": r.get("UserStatus"),
        "Enabled": r.get("Enabled", True),
        "UserCreateDate": r.get("UserCreateDate"),
        "UserLastModifiedDate": r.get("UserLastModifiedDate"),
    }


def _target(username: str, claims: dict) -> tuple[dict, bool, set[str]]:
    """(user, is_self, enabled admin usernames) for a path username.

    Enabled only: a disabled admin can't sign in, so it never counts toward "at least one admin".
    """
    user = _get_user(valid_username(username))
    sub = _attrs(user["Attributes"]).get("sub", "")
    is_self = (bool(sub) and sub == claims.get("sub")) or user["Username"] == claims.get("username")
    return user, is_self, _admin_usernames(enabled_only=True)


_LAST_ADMIN = "There must always be at least one admin."


def _guard_last_admin(user: dict, admins: set[str]) -> None:
    if user["Username"] in admins and len(admins) <= 1:
        raise ApiError(409, _LAST_ADMIN)


def _ensure_admin_left(rollback) -> None:
    """Re-count enabled admins live AFTER a demote/disable; if none are left, undo the change and 409.

    The pre-change guard is check-then-act: two admins demoting/disabling each other at the same moment can
    both pass it and leave zero admins. Re-reading after our own write closes that: whichever request
    re-counts last sees zero and rolls back (both may, which is the safe outcome; either can simply retry).
    """
    if _admin_usernames(enabled_only=True):
        return
    try:
        rollback()
    except ClientError:
        logger.exception("rollback failed: no enabled admin left; restore one with scripts/make-admin.sh")
        msg = "That change left no admin and couldn't be undone. Run scripts/make-admin.sh."
        raise ApiError(500, msg) from None
    logger.warning("change rolled back: it would have left no enabled admin")
    raise ApiError(409, _LAST_ADMIN)


def _respond_user(username: str, claims: dict, **extra) -> dict:
    return {"user": _shape(_get_user(username), _admin_usernames(), claims.get("sub", "")), **extra}


# ── routes ──────────────────────────────────────────────────────────────
@app.get("/admin/users")
def list_users():
    claims = require_admin()
    admins = _admin_usernames()
    users: list[dict] = []
    kwargs = {"UserPoolId": pool(), "Limit": 60}
    while True:
        page = cognito().list_users(**kwargs)
        users.extend(page.get("Users", []))
        token = page.get("PaginationToken")
        if not token:
            break
        kwargs["PaginationToken"] = token
    shaped = sorted((_shape(u, admins, claims.get("sub", "")) for u in users), key=lambda u: u["email"])
    logger.info("users listed", extra={"count": len(shaped)})
    return shaped


@app.post("/admin/users")
def invite_user():
    claims = require_admin()
    data = body()
    email = valid_email(data.get("email"))
    make_admin = data.get("admin", False)
    if not isinstance(make_admin, bool):
        raise ApiError(400, "`admin` must be true or false.")
    password = temp_password()
    created = cognito().admin_create_user(
        UserPoolId=pool(),
        Username=email,
        UserAttributes=[{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"}],
        TemporaryPassword=password,
        DesiredDeliveryMediums=["EMAIL"],
    )["User"]
    if make_admin:
        cognito().admin_add_user_to_group(
            UserPoolId=pool(), Username=created["Username"], GroupName=ADMIN_GROUP
        )
    logger.info("user invited", extra={"admin": make_admin})
    return Response(
        status_code=201,
        content_type="application/json",
        body=_dumps(_respond_user(created["Username"], claims, temporaryPassword=password)),
    )


@app.post("/admin/users/<username>/disable")
def disable_user(username: str):
    claims = require_admin()
    user, is_self, admins = _target(username, claims)
    if is_self:
        raise ApiError(409, "You can't disable your own account.")
    _guard_last_admin(user, admins)
    cognito().admin_disable_user(UserPoolId=pool(), Username=user["Username"])
    _ensure_admin_left(lambda: cognito().admin_enable_user(UserPoolId=pool(), Username=user["Username"]))
    cognito().admin_user_global_sign_out(UserPoolId=pool(), Username=user["Username"])
    logger.info("user disabled")
    return _respond_user(user["Username"], claims)


@app.post("/admin/users/<username>/enable")
def enable_user(username: str):
    claims = require_admin()
    user, _is_self, _admins = _target(username, claims)
    cognito().admin_enable_user(UserPoolId=pool(), Username=user["Username"])
    logger.info("user enabled")
    return _respond_user(user["Username"], claims)


@app.post("/admin/users/<username>/reset-password")
def reset_password(username: str):
    claims = require_admin()
    user, is_self, _admins = _target(username, claims)
    if is_self:
        raise ApiError(409, "Use “Change password” under Your account for your own password.")
    password = temp_password()
    cognito().admin_set_user_password(
        UserPoolId=pool(), Username=user["Username"], Password=password, Permanent=False
    )
    cognito().admin_user_global_sign_out(UserPoolId=pool(), Username=user["Username"])
    logger.info("password reset")
    return _respond_user(user["Username"], claims, temporaryPassword=password)


@app.post("/admin/users/<username>/resend")
def resend_invite(username: str):
    claims = require_admin()
    user, _is_self, _admins = _target(username, claims)
    if user.get("UserStatus") != "FORCE_CHANGE_PASSWORD":
        raise ApiError(409, "They've already set a password. Use “Reset password” instead.")
    email = _attrs(user["Attributes"]).get("email", "")
    if not email:
        raise ApiError(409, "They have no email address on file. Use “Reset password” instead.")
    password = temp_password()
    # RESEND addresses the user by the sign-in alias (email), the same value the invite was created with.
    cognito().admin_create_user(
        UserPoolId=pool(),
        Username=email,
        TemporaryPassword=password,
        MessageAction="RESEND",
        DesiredDeliveryMediums=["EMAIL"],
    )
    logger.info("invite resent")
    return _respond_user(user["Username"], claims, temporaryPassword=password)


@app.post("/admin/users/<username>/admin")
def set_admin(username: str):
    claims = require_admin()
    want = body().get("admin")
    if not isinstance(want, bool):
        raise ApiError(400, "`admin` must be true or false.")
    user, is_self, admins = _target(username, claims)
    if want:
        cognito().admin_add_user_to_group(UserPoolId=pool(), Username=user["Username"], GroupName=ADMIN_GROUP)
    else:
        if is_self:
            raise ApiError(409, "You can't remove your own admin access.")
        _guard_last_admin(user, admins)
        cognito().admin_remove_user_from_group(
            UserPoolId=pool(), Username=user["Username"], GroupName=ADMIN_GROUP
        )
        _ensure_admin_left(
            lambda: cognito().admin_add_user_to_group(
                UserPoolId=pool(), Username=user["Username"], GroupName=ADMIN_GROUP
            )
        )
    logger.info("admin changed", extra={"admin": want})
    return _respond_user(user["Username"], claims)


@app.delete("/admin/users/<username>")
def delete_user(username: str):
    claims = require_admin()
    purge = (app.current_event.get_query_string_value("purge") or "").lower() in ("1", "true", "yes")
    user, is_self, admins = _target(username, claims)
    if is_self:
        raise ApiError(409, "You can't remove your own account.")
    _guard_last_admin(user, admins)
    purged = {"items": 0, "photos": 0}
    if purge:
        sub = _attrs(user["Attributes"]).get("sub", "")
        if not _SUB_RE.match(sub):
            raise ApiError(500, "Couldn't find that user's data id. Nothing was deleted.")
        # Data first, account last: if the purge fails, the user still exists and the admin can retry.
        purged = {"items": _purge_items(sub), "photos": _purge_photos(sub)}
    # Delete can't be rolled back, so re-verify live right before it: excluding the target, at least one
    # enabled admin must remain (normally the caller, who was live-verified in require_admin and can't be
    # the target). RESIDUAL WINDOW: between this read and AdminDeleteUser, a concurrent request could
    # disable/demote the caller; that request's own post-change re-count still sees the target (not deleted
    # yet), so it won't roll back, and the pool could end with zero enabled admins. It needs two admins
    # acting on each other within milliseconds and is recoverable by the owner (scripts/make-admin.sh), so
    # we log loudly instead of locking. (If this trips after a purge, the data is gone but the account and
    # every admin remain: the safe side to fail on.)
    if not _admin_usernames(enabled_only=True) - {user["Username"]}:
        raise ApiError(409, _LAST_ADMIN)
    cognito().admin_delete_user(UserPoolId=pool(), Username=user["Username"])
    if not _admin_usernames(enabled_only=True):
        logger.error("no enabled admin left after delete; seed one with scripts/make-admin.sh")
    logger.info("user deleted", extra=purged)
    return {"deleted": True, "purged": purged}


# ── purge (only ever the target's own partition and prefix) ─────────────
def _purge_items(sub: str) -> int:
    kwargs = {
        "KeyConditionExpression": Key("pk").eq(f"USER#{sub}"),
        "ProjectionExpression": "pk, sk",
    }
    count = 0
    with table().batch_writer() as batch:
        while True:
            page = table().query(**kwargs)
            for item in page.get("Items", []):
                batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
                count += 1
            if "LastEvaluatedKey" not in page:
                break
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    return count


def _purge_photos(sub: str) -> int:
    bucket = os.environ["PHOTO_BUCKET"]
    prefix = f"users/{sub}/"
    count = 0
    kwargs = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
    while True:
        page = s3().list_objects_v2(**kwargs)
        keys = [o["Key"] for o in page.get("Contents", []) if o["Key"].startswith(prefix)]
        if keys:
            objects = [{"Key": k} for k in keys]
            res = s3().delete_objects(Bucket=bucket, Delete={"Objects": objects, "Quiet": True})
            if res.get("Errors"):
                # Per-key failures don't raise. Keep the account so the admin can retry.
                logger.error("photo purge failed", extra={"failed": len(res["Errors"])})
                raise ApiError(500, "Couldn't delete all their screenshots. Account kept; try again.")
            count += len(keys)
        if not page.get("IsTruncated"):
            return count
        kwargs["ContinuationToken"] = page["NextContinuationToken"]


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
def lambda_handler(event, context):
    return app.resolve(event, context)
