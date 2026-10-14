"""One requests.Session for every provider: short timeouts, one GET retry, typed failures (from ClearVest)."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from mktdata.errors import UpstreamError

USER_AGENT = "Mozilla/5.0 (compatible; tradejournal-market/2.0)"
_session: requests.Session | None = None


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        # Retry-After is ignored so a 429 can't park the Lambda for its whole timeout.
        retry = Retry(
            total=1,
            backoff_factor=0.3,
            status_forcelist=(429, 500, 502, 503, 504),
            respect_retry_after_header=False,
            raise_on_status=False,
        )
        _session = requests.Session()
        _session.headers["User-Agent"] = USER_AGENT
        _session.mount("https://", HTTPAdapter(max_retries=retry))
    return _session


def request(method: str, url: str, *, provider: str, timeout: float = 5, **kwargs) -> requests.Response:
    try:
        resp = _get_session().request(method, url, timeout=timeout, **kwargs)
    except requests.RequestException as err:
        # Never str(err): requests embeds the full URL (incl. apikey query params) in its messages.
        parts = urlsplit(url)
        raise UpstreamError(provider, f"{type(err).__name__} calling {parts.netloc}{parts.path}") from err
    if resp.status_code >= 400:
        raise UpstreamError(provider, f"HTTP {resp.status_code}", status=resp.status_code)
    return resp


def request_json(method: str, url: str, *, provider: str, timeout: float = 5, **kwargs) -> Any:
    resp = request(method, url, provider=provider, timeout=timeout, **kwargs)
    try:
        return resp.json()
    except ValueError as err:
        raise UpstreamError(provider, "response was not JSON") from err


def reset() -> None:
    global _session
    _session = None
