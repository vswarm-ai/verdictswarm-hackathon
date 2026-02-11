"""Metrics service — Redis-backed counters for observability.

All counters organized by date for time-series queries.
Designed for agent consumption (SRE bot polls /api/metrics).
"""

from datetime import datetime, timezone
from typing import Optional


class MetricsService:
    def __init__(self, redis_client):
        self.r = redis_client

    async def track(self, metric: str, value: int = 1, tags: dict = None):
        """Increment a metric counter.

        Keys: metrics:{YYYY-MM-DD}:{HH}:{metric}
        Also rolls up to daily: metrics:{YYYY-MM-DD}:{metric}
        """
        now = datetime.now(timezone.utc)
        date_key = now.strftime("%Y-%m-%d")
        hour_key = now.strftime("%H")

        # Daily counter
        daily_key = f"metrics:{date_key}:{metric}"
        await self.r.incrby(daily_key, value)
        await self.r.expire(daily_key, 86400 * 30)  # 30 day retention

        # Hourly counter (for rate detection)
        hourly_key = f"metrics:{date_key}:{hour_key}:{metric}"
        await self.r.incrby(hourly_key, value)
        await self.r.expire(hourly_key, 86400 * 7)  # 7 day retention

        # Tagged counters (chain, tier, etc.)
        if tags:
            for k, v_tag in tags.items():
                tagged_key = f"metrics:{date_key}:{metric}:{k}={v_tag}"
                await self.r.incrby(tagged_key, value)
                await self.r.expire(tagged_key, 86400 * 30)

    async def track_duration(self, metric: str, duration_ms: int):
        """Track a duration metric (stores sum + count for averaging)."""
        now = datetime.now(timezone.utc)
        date_key = now.strftime("%Y-%m-%d")

        sum_key = f"metrics:{date_key}:{metric}_sum_ms"
        count_key = f"metrics:{date_key}:{metric}_count"

        pipe = self.r.pipeline()
        pipe.incrby(sum_key, duration_ms)
        pipe.incr(count_key)
        pipe.expire(sum_key, 86400 * 30)
        pipe.expire(count_key, 86400 * 30)
        await pipe.execute()

    async def get_snapshot(self, date: str = None) -> dict:
        """Full metrics snapshot for a given date (default: today).

        Returns dict ready for API response / agent consumption.
        """
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Get all daily keys for this date
        pattern = f"metrics:{date}:*"
        metrics = {}
        async for key in self.r.scan_iter(match=pattern):
            key_str = key if isinstance(key, str) else key.decode()
            parts = key_str.split(":")
            # Daily keys: metrics:date:metric or metrics:date:metric:tag=val
            # Skip hourly keys: metrics:date:HH:metric (where HH is 2 digits)
            after_date = parts[2] if len(parts) > 2 else ""
            if len(after_date) == 2 and after_date.isdigit():
                continue  # hourly key
            name = key_str.replace(f"metrics:{date}:", "")
            val = await self.r.get(key)
            metrics[name] = int(val or 0)

        # Compute derived metrics
        total_scans = metrics.get("scans_total", 0)
        cache_hits = metrics.get("cache_hits", 0)
        errors = metrics.get("errors_total", 0)

        # Duration averages
        dur_sum = metrics.pop("scan_duration_sum_ms", 0)
        dur_count = metrics.pop("scan_duration_count", 0)
        avg_duration_ms = round(dur_sum / max(dur_count, 1))

        return {
            "date": date,
            "counters": metrics,
            "derived": {
                "cache_hit_rate": round(cache_hits / max(total_scans, 1) * 100, 1),
                "error_rate": round(errors / max(total_scans, 1) * 100, 1),
                "scans_total": total_scans,
                "avg_duration_ms": avg_duration_ms,
            },
        }

    async def get_hourly(self, date: str = None) -> dict:
        """Hourly breakdown for today (for rate/trend detection)."""
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        hourly = {}
        for hour in range(24):
            hh = f"{hour:02d}"
            key = f"metrics:{date}:{hh}:scans_total"
            val = await self.r.get(key)
            if val:
                hourly[f"{hh}:00"] = int(val)

        return {"date": date, "hourly_scans": hourly}
