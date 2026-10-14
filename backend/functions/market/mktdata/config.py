"""The FMP key from an SSM SecureString, fetched once per container and never logged.

FMP_KEY_PARAM holds the parameter *name* (default `clearvest-fmp`, the key ClearVest already uses).
A missing/denied parameter makes FMP "unavailable" for this request; it never fails cold start.
"""

from __future__ import annotations

import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from mktdata.errors import Unavailable

DEFAULT_FMP_PARAM = "clearvest-fmp"
_cache: dict[str, str] = {}
_ssm = None


def _client():
    global _ssm
    if _ssm is None:
        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
        _ssm = boto3.client("ssm", region_name=region)
    return _ssm


def parameter_name(raw: str) -> str:
    """Hierarchical names need a leading slash; the template passes names without one so ARNs stay valid."""
    return f"/{raw.lstrip('/')}" if "/" in raw else raw


def fmp_key() -> str:
    name = parameter_name(os.environ.get("FMP_KEY_PARAM") or DEFAULT_FMP_PARAM)
    if name not in _cache:
        try:
            resp = _client().get_parameter(Name=name, WithDecryption=True)
        except ClientError as err:
            raise Unavailable("config", f"SSM {name}: {err.response['Error']['Code']}") from err
        except BotoCoreError as err:
            raise Unavailable("config", f"SSM {name}: {type(err).__name__}") from err
        _cache[name] = resp["Parameter"]["Value"]
    return _cache[name]


def reset() -> None:
    global _ssm
    _cache.clear()
    _ssm = None
