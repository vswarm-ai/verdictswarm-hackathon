"""Simple JSON-backed rate limiting for VerdictSwarm.

Tracks usage *per wallet* and enforces per-tier daily limits.

This is intentionally lightweight (stdlib-only) and designed to be swapped for
Redis/DB later.

Data model (JSON):
{
  "wallet": {
    "date": "YYYY-MM-DD",
    "counts": {"tier_1": 3, "tier_2": 0, "swarm_debate": 1}
  }
}

Notes:
- Date is UTC to avoid local time ambiguity.
- Limits are sourced from tier_config.get_rate_limit.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple

from .tier_config import get_rate_limit
from .tiers import TierLevel


class RateLimitExceeded(RuntimeError):
    def __init__(self, *, wallet: str, tier: TierLevel, limit: int, used: int) -> None:
        super().__init__(f"Rate limit exceeded for {wallet} at {tier.value}: used {used}/{limit} today")
        self.wallet = wallet
        self.tier = tier
        self.limit = int(limit)
        self.used = int(used)


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass
class Quota:
    tier: TierLevel
    limit: int
    used: int

    @property
    def remaining(self) -> int:
        if self.limit < 0:
            return 1_000_000_000
        return max(0, self.limit - self.used)


class RateLimiter:
    def __init__(self, *, db_path: Optional[str] = None) -> None:
        # Default inside repo so local CLI runs without extra setup.
        default = Path(__file__).resolve().parents[1] / ".rate_limits.json"
        self._path = Path(db_path or os.getenv("VSWARM_RATE_LIMIT_DB") or str(default)).expanduser()

    # ----------------- storage -----------------

    def _read(self) -> Dict[str, Dict[str, object]]:
        try:
            if not self._path.exists():
                return {}
            raw = self._path.read_text(encoding="utf-8")
            obj = json.loads(raw)
            return obj if isinstance(obj, dict) else {}
        except Exception:
            return {}

    def _write(self, obj: Dict[str, Dict[str, object]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        tmp.replace(self._path)

    # ----------------- public API -----------------

    @staticmethod
    def normalize_wallet(wallet: str) -> str:
        w = (wallet or "").strip().lower()
        return w or "local"

    def get_quota(self, *, wallet: str, tier: TierLevel) -> Quota:
        w = self.normalize_wallet(wallet)
        day = _utc_day()
        limit = int(get_rate_limit(tier))

        db = self._read()
        rec = db.get(w) or {}
        rec_day = str(rec.get("date") or "")
        counts = rec.get("counts") if isinstance(rec.get("counts"), dict) else {}
        if rec_day != day:
            used = 0
        else:
            used = int((counts or {}).get(tier.value, 0) or 0)

        return Quota(tier=tier, limit=limit, used=used)

    def check_and_increment(
        self,
        *,
        wallet: str,
        tier: TierLevel,
        units: int = 1,
        allow_overage: bool = False,
    ) -> Tuple[Quota, bool]:
        """Check quota and increment usage.

        Returns (quota_after_increment, exceeded).

        If allow_overage=True and tier has a positive limit, we still increment
        even if the limit would be exceeded. Caller can use the exceeded flag
        to trigger a burn mechanism (SWARM_DEBATE).
        """

        w = self.normalize_wallet(wallet)
        u = max(1, int(units))
        day = _utc_day()
        limit = int(get_rate_limit(tier))

        db = self._read()
        rec = db.get(w)
        if not isinstance(rec, dict):
            rec = {}

        if str(rec.get("date") or "") != day:
            rec = {"date": day, "counts": {}}

        counts = rec.get("counts")
        if not isinstance(counts, dict):
            counts = {}

        used = int(counts.get(tier.value, 0) or 0)
        exceeded = False

        if limit >= 0 and (used + u) > limit:
            exceeded = True
            if not allow_overage:
                raise RateLimitExceeded(wallet=w, tier=tier, limit=limit, used=used)

        counts[tier.value] = int(used + u)
        rec["counts"] = counts
        db[w] = rec
        self._write(db)

        return Quota(tier=tier, limit=limit, used=int(used + u)), exceeded


__all__ = ["RateLimiter", "Quota", "RateLimitExceeded"]
