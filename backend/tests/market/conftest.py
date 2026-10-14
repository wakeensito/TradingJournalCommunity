"""Fixtures for the market tests live in market_helpers.py (importable under --import-mode=importlib)."""

import sys
from pathlib import Path

_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.append(_HERE)

from market_helpers import world  # noqa: E402,F401
