"""Base agent scaffolding for VerdictSwarm.

Agents are small, focused analyzers that take structured ``token_data`` and
return an :class:`~scoring_engine.AgentVerdict`.

This module provides:
- An abstract :class:`BaseAgent` interface.
- :class:`AgentEventEmitter` — typed callback interface for streaming events.
- :class:`NullEmitter` — silent default so existing code is unaffected.
- Light logging utilities.
- Timing utilities for measuring analysis duration.

The concrete agents in ``src/agents`` should remain dependency-light.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterator, Optional

try:
    # Optional shared LLM client (dependency-free stdlib HTTP).
    from .ai_client import AIClient  # type: ignore
except Exception:  # pragma: no cover
    AIClient = Any  # type: ignore

try:
    # When VerdictSwarm is installed as a package (e.g. `python -m verdictswarm`).
    from ..scoring_engine import AgentVerdict  # type: ignore
except ImportError:  # pragma: no cover
    # When running from this repo with `src/` on PYTHONPATH.
    from scoring_engine import AgentVerdict


# ---------------------------------------------------------------------------
# Agent Event Emitter
# ---------------------------------------------------------------------------

class AgentEventEmitter:
    """Typed callback interface that agents use to emit streaming events.

    Agents call ``emitter.thinking("Reading contract…")``, etc.
    The concrete implementation bridges to the :class:`EventBus`; agents
    never import or know about SSE, the bus, or the UI.

    All methods are no-ops by default (see :class:`NullEmitter`).
    Subclass or duck-type to provide a real implementation.
    """

    def thinking(self, message: str) -> None:
        """Agent is processing / reasoning about something."""

    def finding(self, severity: str, message: str, evidence: Optional[str] = None) -> None:
        """Agent discovered a specific finding.

        Args:
            severity: ``"critical"`` | ``"warning"`` | ``"info"`` | ``"positive"``
            message: Human-readable description.
            evidence: Optional supporting data (tx hash, link, metric, etc.).
        """

    def progress(self, step: str) -> None:
        """Agent moved to a named processing step."""

    def warning(self, message: str) -> None:
        """Non-fatal warning (e.g. rate-limited, partial data)."""


class NullEmitter(AgentEventEmitter):
    """Silent emitter — every method is a no-op.

    Used as the default when no emitter is supplied, so existing agent
    code is fully backwards-compatible.
    """


class CallbackEmitter(AgentEventEmitter):
    """Emitter that delegates to plain callables.

    This is the bridge between the agent world and the EventBus.
    The streaming router creates one of these per agent run, wiring
    each method to ``bus.emit(…)``.
    """

    def __init__(
        self,
        *,
        on_thinking: Optional[Callable[[str], None]] = None,
        on_finding: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_progress: Optional[Callable[[str], None]] = None,
        on_warning: Optional[Callable[[str], None]] = None,
    ) -> None:
        self._on_thinking = on_thinking
        self._on_finding = on_finding
        self._on_progress = on_progress
        self._on_warning = on_warning

    def thinking(self, message: str) -> None:
        if self._on_thinking:
            self._on_thinking(message)

    def finding(self, severity: str, message: str, evidence: Optional[str] = None) -> None:
        if self._on_finding:
            self._on_finding(severity, message, evidence)

    def progress(self, step: str) -> None:
        if self._on_progress:
            self._on_progress(step)

    def warning(self, message: str) -> None:
        if self._on_warning:
            self._on_warning(message)


# Default singleton used when no emitter is supplied.
_NULL_EMITTER = NullEmitter()


@dataclass(frozen=True)
class TimingInfo:
    """Timing metadata for an analysis run."""

    elapsed_ms: float


class BaseAgent(ABC):
    """Abstract base class for all VerdictSwarm agents.

    Concrete agents must implement :meth:`analyze` and expose identifying
    metadata via :pyattr:`name`, :pyattr:`category`, and :pyattr:`description`.

    Notes:
        - ``category`` is typically one of: Technical, Safety, Tokenomics,
          Social, Macro. (Devil's advocate may choose to omit a category.)
        - Agents should be deterministic given the same input (avoid randomness)
          unless explicitly intended.
    """

    def __init__(
        self,
        *,
        logger: Optional[logging.Logger] = None,
        ai_client: Optional["AIClient"] = None,
        provider_model: Optional[tuple[str, str]] = None,
        model_overrides: Optional[Dict[str, str]] = None,
        emitter: Optional[AgentEventEmitter] = None,
    ) -> None:
        self._logger = logger or logging.getLogger(self.__class__.__name__)
        self._ai_client = ai_client
        # Preferred single-provider routing (new): (provider, model)
        self._provider_model = tuple(provider_model) if provider_model else None
        # Legacy per-provider overrides (kept for backwards compatibility)
        # e.g. {"gemini": "gemini-3-pro", "xai": "grok-4"}
        self._model_overrides = dict(model_overrides or {})
        self._emitter: AgentEventEmitter = emitter or _NULL_EMITTER

    @property
    def emitter(self) -> AgentEventEmitter:
        """Event emitter for streaming agent progress to the UI."""
        return self._emitter

    @emitter.setter
    def emitter(self, value: AgentEventEmitter) -> None:
        self._emitter = value or _NULL_EMITTER

    @property
    def ai_client(self) -> Optional["AIClient"]:
        """Optional shared AI client injected by the caller."""

        return self._ai_client

    def model_for(self, provider: str) -> Optional[str]:
        """Return the model ID override for a provider (if any)."""

        return (self._model_overrides or {}).get(str(provider))

    def routed_provider_model(self) -> Optional[tuple[str, str]]:
        """Return the router-selected (provider, model) tuple (if any)."""

        return self._provider_model

    @property
    @abstractmethod
    def name(self) -> str:
        """Agent name used as a stable identifier in scoring."""

    @property
    @abstractmethod
    def category(self) -> str:
        """High-level category label (e.g. "Technical", "Safety")."""

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of what the agent evaluates."""

    @abstractmethod
    def analyze(self, token_data: Dict[str, object]) -> AgentVerdict:
        """Analyze a token and return a verdict.

        Args:
            token_data: Arbitrary structured data about a token (on-chain,
                socials, market, etc.). Shape is intentionally flexible.

        Returns:
            AgentVerdict: The agent's score/sentiment/reasoning.
        """

    # ---------------------------
    # Utilities
    # ---------------------------

    @property
    def logger(self) -> logging.Logger:
        """Agent-scoped logger."""

        return self._logger

    @contextmanager
    def timed(self, label: str = "analyze") -> Iterator[TimingInfo]:
        """Context manager that logs and returns elapsed time.

        Usage:
            with self.timed("analyze") as t:
                verdict = ...
            self.logger.info("took %.1fms", t.elapsed_ms)

        Args:
            label: A short operation label for logs.

        Yields:
            TimingInfo with ``elapsed_ms`` populated after the block.
        """

        start = time.perf_counter()
        info = TimingInfo(elapsed_ms=0.0)
        try:
            yield info
        finally:
            end = time.perf_counter()
            object.__setattr__(info, "elapsed_ms", (end - start) * 1000.0)
            self.logger.debug("%s took %.1fms", label, info.elapsed_ms)

    def _prepend_fact_sheet(self, token_data: Dict[str, object], user_prompt: str) -> str:
        """Prepend the verified fact sheet to a user prompt if available.

        Checks ``token_data.preprocessed_facts`` (set by the Token Preprocessor
        in stream_scan.py).  If present, formats the fact sheet for this agent
        (with category-specific context highlight) and prepends it.  Otherwise
        appends a degraded-mode notice.

        Args:
            token_data: The token data object (may have ``preprocessed_facts`` attr).
            user_prompt: The existing user prompt string.

        Returns:
            Modified user prompt string with fact sheet prefix (or degraded notice).
        """
        try:
            from src.services.token_preprocessor import (
                format_degraded_mode_notice,
                format_fact_sheet_for_agent,
            )

            facts = getattr(token_data, "preprocessed_facts", None)
            news = getattr(token_data, "news_context", None)

            parts = []
            if facts is not None:
                parts.append(format_fact_sheet_for_agent(facts, self.name))
            else:
                parts.append(format_degraded_mode_notice())

            # News injection removed — models have native real-time access

            parts.append(user_prompt)
            return "\n\n".join(parts)
        except Exception as e:
            self._logger.debug("Fact sheet injection skipped: %s", e)
            return user_prompt

    def log_inputs(self, token_data: Dict[str, object], *, max_keys: int = 30) -> None:
        """Log a lightweight preview of token_data.

        Avoids dumping huge payloads into logs.
        """

        keys = list(token_data.keys())
        preview = keys[:max_keys]
        more = "" if len(keys) <= max_keys else f" (+{len(keys) - max_keys} more)"
        self.logger.debug("token_data keys: %s%s", preview, more)


def _example_usage() -> None:
    """Example showing how a concrete agent might be called."""

    class _DemoAgent(BaseAgent):
        @property
        def name(self) -> str:  # noqa: D401
            return "DemoAgent"

        @property
        def category(self) -> str:  # noqa: D401
            return "Technical"

        @property
        def description(self) -> str:  # noqa: D401
            return "Demonstration agent used only for BaseAgent examples."

        def analyze(self, token_data: Dict[str, object]) -> AgentVerdict:
            with self.timed():
                self.log_inputs(token_data)
                return AgentVerdict(
                    score=5.0,
                    sentiment="neutral",
                    reasoning="Placeholder verdict from demo agent.",
                    category="Technical",
                )

    logging.basicConfig(level=logging.INFO)
    agent = _DemoAgent()
    verdict = agent.analyze({"symbol": "DEMO"})
    print(verdict)


if __name__ == "__main__":
    _example_usage()
