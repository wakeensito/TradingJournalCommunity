"""Typed upstream failures. `detail` is for logs only and never contains query strings (API keys)."""

from __future__ import annotations


class UpstreamError(Exception):
    def __init__(self, provider: str, detail: str, status: int | None = None):
        super().__init__(f"{provider}: {detail}")
        self.provider = provider
        self.detail = detail
        self.status = status


class Unavailable(UpstreamError):
    """The source exists but this deployment can't use it (no key, plan excludes the endpoint)."""
