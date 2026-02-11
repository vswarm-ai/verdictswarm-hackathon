"""Swarm Debate burn tracking (simulation).

BUSINESS_MODEL.md:
- SWARM_DEBATE tier includes 5 debates/day.
- Additional debates burn 100-500 $VSWARM per use.

This module tracks (simulated) burns for future on-chain integration.
It does NOT execute any on-chain actions.

JSON schema:
{
  "events": [
    {
      "ts": "2026-02-03T15:00:00Z",
      "date": "2026-02-03",
      "wallet": "0xabc...",
      "extra_index": 1,
      "burn_amount": 100
    }
  ]
}
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def _utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def calculate_burn_amount(extra_index: int) -> int:
    """Calculate burn amount for the Nth extra debate of the day.

    extra_index=1 => first extra debate beyond included quota.
    Burn schedule (simple ramp): 100,200,300,400,500 then 500...
    """

    n = max(1, int(extra_index))
    return min(500, 100 * n)


@dataclass(frozen=True)
class BurnEvent:
    ts: str
    date: str
    wallet: str
    extra_index: int
    burn_amount: int


class BurnTracker:
    def __init__(self, *, db_path: Optional[str] = None) -> None:
        default = Path(__file__).resolve().parents[1] / ".burns.json"
        self._path = Path(db_path or os.getenv("VSWARM_BURN_DB") or str(default)).expanduser()

    @staticmethod
    def normalize_wallet(wallet: str) -> str:
        w = (wallet or "").strip().lower()
        return w or "local"

    def _read(self) -> Dict[str, Any]:
        try:
            if not self._path.exists():
                return {"events": []}
            obj = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(obj, dict) and isinstance(obj.get("events"), list):
                return obj
        except Exception:
            pass
        return {"events": []}

    def _write(self, obj: Dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        tmp.replace(self._path)

    def list_events(self) -> List[BurnEvent]:
        obj = self._read()
        out: List[BurnEvent] = []
        for e in obj.get("events") or []:
            if not isinstance(e, dict):
                continue
            try:
                out.append(
                    BurnEvent(
                        ts=str(e.get("ts")),
                        date=str(e.get("date")),
                        wallet=str(e.get("wallet")),
                        extra_index=int(e.get("extra_index")),
                        burn_amount=int(e.get("burn_amount")),
                    )
                )
            except Exception:
                continue
        return out

    def record_extra_debate(self, *, wallet: str, extra_index: int) -> BurnEvent:
        w = self.normalize_wallet(wallet)
        ev = BurnEvent(
            ts=_utc_iso(),
            date=_utc_day(),
            wallet=w,
            extra_index=max(1, int(extra_index)),
            burn_amount=calculate_burn_amount(extra_index),
        )

        obj = self._read()
        events = obj.get("events")
        if not isinstance(events, list):
            events = []
        events.append(
            {
                "ts": ev.ts,
                "date": ev.date,
                "wallet": ev.wallet,
                "extra_index": ev.extra_index,
                "burn_amount": ev.burn_amount,
            }
        )
        obj["events"] = events
        self._write(obj)
        return ev


__all__ = ["BurnTracker", "BurnEvent", "calculate_burn_amount"]
