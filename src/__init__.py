"""VerdictSwarm (Python MVP).

This directory is treated as the Python package root for the VerdictSwarm
prototype.

Key modules:
- :mod:`scoring_engine` — weighted aggregation and consensus utilities.
- :mod:`agents` — specialist agents (currently mock logic).

The CLI entry point lives in :mod:`__main__` so it can be run with:

    python -m verdictswarm analyze <TOKEN>

Packaging for this repo is intentionally minimal.
"""

from __future__ import annotations

__all__ = [
    "agents",
    "scoring_engine",
]
