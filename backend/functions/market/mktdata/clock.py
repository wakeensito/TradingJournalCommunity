"""One clock for the whole function so tests can freeze it. Market days are America/New_York days."""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")


def now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def today_et() -> dt.date:
    return now().astimezone(NY).date()


def epoch() -> int:
    return int(now().timestamp())
