"""In-memory event bus for scan streaming.

Thread-safe event collection with subscriber notification and replay support.
See docs/STREAMING_ARCHITECTURE.md Layer 2.
"""

from __future__ import annotations

import threading
from typing import Any, Callable, Dict, List, Optional

from ..models.scan_events import ScanEvent


class ScanEventBus:
    """Collects events from agents/debate engine, fans out to subscribers.

    Thread-safe: agents may run in a thread pool via anyio.to_thread.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: List[ScanEvent] = []
        self._subscribers: List[Callable[[ScanEvent], None]] = []

    def emit(self, event: ScanEvent) -> None:
        """Store event and notify all subscribers."""
        with self._lock:
            self._events.append(event)
            for sub in self._subscribers:
                try:
                    sub(event)
                except Exception:
                    pass  # Don't let a bad subscriber break the pipeline

    def subscribe(self, callback: Callable[[ScanEvent], None]) -> Callable[[], None]:
        """Subscribe to all events. Returns unsubscribe function."""
        with self._lock:
            self._subscribers.append(callback)

        def unsubscribe() -> None:
            with self._lock:
                try:
                    self._subscribers.remove(callback)
                except ValueError:
                    pass

        return unsubscribe

    def replay(self, after_timestamp: Optional[int] = None) -> List[ScanEvent]:
        """Return all events, optionally after a given timestamp (for SSE reconnection)."""
        with self._lock:
            if after_timestamp is None:
                return list(self._events)
            return [e for e in self._events if e.timestamp > after_timestamp]

    def clear(self) -> None:
        """Reset for a new scan."""
        with self._lock:
            self._events.clear()
            self._subscribers.clear()

    @property
    def event_count(self) -> int:
        with self._lock:
            return len(self._events)
