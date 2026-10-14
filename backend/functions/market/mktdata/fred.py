"""FRED via the keyless fredgraph.csv download (ClearVest pattern), bounded with cosd/coed."""

from __future__ import annotations

import csv
import datetime as dt
import io

from mktdata import http

URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"


def observations(series_id: str, start: dt.date, end: dt.date) -> list[tuple[str, float]]:
    """Oldest first. Missing values ('.' or empty, e.g. holidays) are skipped. Columns are read by
    position because the date header has been both `DATE` and `observation_date`."""
    resp = http.request(
        "GET",
        URL,
        provider="fred",
        timeout=5,
        params={"id": series_id, "cosd": start.isoformat(), "coed": end.isoformat()},
    )
    out = []
    for row in list(csv.reader(io.StringIO(resp.text)))[1:]:
        if len(row) < 2:
            continue
        try:
            out.append((row[0], float(row[1])))
        except ValueError:
            continue
    return out
