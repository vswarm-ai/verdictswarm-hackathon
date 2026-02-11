"""VerdictSwarm scoring engine (MVP).

This module provides a minimal, dependency-free scoring engine for aggregating
multiple agent verdicts into a single weighted score and human-readable summary.

Core ideas:
- Each agent produces a score (0-10), sentiment, and reasoning.
- Agents are mapped to a category (Technical/Safety/Tokenomics/Social/Macro).
- Category weights are applied to compute a final weighted score.

The MVP intentionally keeps the API small and the logic transparent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Literal, Mapping, Optional, Tuple


Sentiment = Literal["bullish", "bearish", "neutral"]
Category = Literal["Technical", "Safety", "Tokenomics", "Social", "Macro"]


DEFAULT_CATEGORY_WEIGHTS: Mapping[Category, float] = {
    "Technical": 0.25,
    "Safety": 0.25,
    "Tokenomics": 0.20,
    "Social": 0.15,
    "Macro": 0.15,
}


@dataclass(frozen=True)
class AgentVerdict:
    """Single agent's verdict.

    Attributes:
        score: Numeric score from 0 to 10 inclusive. (float allowed)
        sentiment: "bullish", "bearish", or "neutral".
        reasoning: Short free-text explanation.
        category: Optional category for this verdict. If omitted, ScoringEngine
            will look it up via its agent->category mapping.
    """

    score: float
    sentiment: Sentiment
    reasoning: str
    category: Optional[Category] = None
    confidence: float = 1.0


@dataclass(frozen=True)
class ScoringResult:
    """Result of scoring an asset."""

    final_score: float
    final_sentiment: Sentiment
    confidence: float
    category_scores: Mapping[Category, float]
    category_sentiments: Mapping[Category, Sentiment]
    used_weights: Mapping[Category, float]
    summary: str


class ScoringEngine:
    """Aggregate agent verdicts into a weighted final score.

    Parameters:
        category_weights: Category weights used to compute final score.
        agent_category_map: Map of agent name -> category.
        missing_category_policy:
            - "renormalize": compute score using only categories present,
              renormalizing weights to sum to 1 across present categories.
            - "neutral": missing categories are treated as neutral score=5.

    Notes:
        - If multiple agents map to the same category, their scores are averaged.
        - A "DevilsAdvocate" agent can be included; by default this engine does
          not weight it directly (it has no category weight). If you map it to a
          real category it will be incorporated like any other agent.
    """

    def __init__(
        self,
        *,
        category_weights: Mapping[Category, float] = DEFAULT_CATEGORY_WEIGHTS,
        agent_category_map: Optional[Mapping[str, Category]] = None,
        missing_category_policy: Literal["renormalize", "neutral"] = "renormalize",
    ) -> None:
        self._weights: Dict[Category, float] = dict(category_weights)
        self._missing_policy = missing_category_policy

        # Common default mapping for the MVP.
        default_map: Dict[str, Category] = {
            "TechnicianBot": "Technical",
            "SecurityBot": "Safety",
            "TokenomicsBot": "Tokenomics",
            "SocialBot": "Social",
            "MacroBot": "Macro",
            # DevilsAdvocate intentionally left unmapped by default.
        }
        self._agent_category_map: Dict[str, Category] = dict(agent_category_map or default_map)

        self._validate_weights()

    def _validate_weights(self) -> None:
        for cat, w in self._weights.items():
            if w < 0:
                raise ValueError(f"Category weight must be >= 0 for {cat}, got {w}")
        total = sum(self._weights.values())
        if total <= 0:
            raise ValueError("Sum of category weights must be > 0")

    @staticmethod
    def _clamp_score(score: float) -> float:
        if score < 0:
            return 0.0
        if score > 10:
            return 10.0
        return float(score)

    @staticmethod
    def _sentiment_from_score(score_0_to_10: float) -> Sentiment:
        """Derive a sentiment from a score.

        Thresholds are intentionally simple for MVP:
        - >= 6.5 bullish
        - <= 3.5 bearish
        - otherwise neutral
        """

        if score_0_to_10 >= 6.5:
            return "bullish"
        if score_0_to_10 <= 3.5:
            return "bearish"
        return "neutral"

    def agent_category(self, agent_name: str) -> Optional[Category]:
        """Return the configured category for an agent, if any."""

        return self._agent_category_map.get(agent_name)

    def verdict_breakdown_by_category(
        self,
        verdicts: Mapping[str, Mapping[str, object] | AgentVerdict],
    ) -> Dict[Category, List[Tuple[str, AgentVerdict]]]:
        """Return agent verdicts grouped by scoring category.

        Notes:
            - Only categories known to this engine are returned.
            - Agents with unknown/unmapped categories are omitted from this breakdown.
              (Use :meth:`_group_verdicts` if you also need unscored agents.)
        """

        _, by_category, _ = self._group_verdicts(verdicts)
        return {cat: list(items) for cat, items in by_category.items()}

    def dissenting_agents(
        self,
        verdicts: Mapping[str, Mapping[str, object] | AgentVerdict] | Mapping[str, AgentVerdict],
    ) -> List[str]:
        """Identify dissenting agents (minority sentiment among scorable agents).

        Dissent is computed using *derived* sentiment from each agent's score,
        not the provided sentiment field (which can be inconsistent).

        If there is no clear majority sentiment (tie), returns an empty list.
        """

        parsed = {
            agent: (v if isinstance(v, AgentVerdict) else self._parse_verdict(agent, v))
            for agent, v in verdicts.items()
        }

        scored = self._scorable_agent_verdicts(parsed)
        if not scored:
            return []

        sentiments = {agent: self._sentiment_from_score(v.score) for agent, v in scored.items()}
        counts: Dict[Sentiment, int] = {"bullish": 0, "bearish": 0, "neutral": 0}
        for s in sentiments.values():
            counts[s] += 1

        max_count = max(counts.values())
        winners = [s for s, c in counts.items() if c == max_count]
        if len(winners) != 1:
            return []
        majority = winners[0]
        return [agent for agent, s in sentiments.items() if s != majority]

    def confidence_score(
        self,
        verdicts: Mapping[str, Mapping[str, object] | AgentVerdict] | Mapping[str, AgentVerdict],
    ) -> float:
        """Compute a confidence score in [0, 1] based on agent agreement.

        Heuristic:
            confidence = majority_fraction * (1 - stddev(scores)/5)

        Where:
            - majority_fraction is the fraction of scorable agents sharing the
              majority derived sentiment.
            - stddev(scores) is the population standard deviation of their
              (clamped) 0-10 scores.
            - 5 is used as a "max reasonable" stddev for normalization.
        """

        parsed = {
            agent: (v if isinstance(v, AgentVerdict) else self._parse_verdict(agent, v))
            for agent, v in verdicts.items()
        }
        scored = self._scorable_agent_verdicts(parsed)
        if not scored:
            return 0.0

        scores = [v.score for v in scored.values()]
        n = len(scores)

        # Majority sentiment agreement.
        derived = [self._sentiment_from_score(s) for s in scores]
        counts: Dict[Sentiment, int] = {"bullish": 0, "bearish": 0, "neutral": 0}
        for s in derived:
            counts[s] += 1
        majority_count = max(counts.values())
        majority_fraction = majority_count / n

        # Standard deviation (population).
        mean = sum(scores) / n
        var = sum((s - mean) ** 2 for s in scores) / n
        std = var ** 0.5
        variance_factor = max(0.0, 1.0 - (std / 5.0))

        return round(max(0.0, min(1.0, majority_fraction * variance_factor)), 2)

    def _group_verdicts(
        self,
        verdicts: Mapping[str, Mapping[str, object] | AgentVerdict],
    ) -> Tuple[Dict[str, AgentVerdict], Dict[Category, List[Tuple[str, AgentVerdict]]], List[Tuple[str, AgentVerdict]]]:
        parsed: Dict[str, AgentVerdict] = {}
        for agent, payload in verdicts.items():
            parsed[agent] = self._parse_verdict(agent, payload)

        by_category: Dict[Category, List[Tuple[str, AgentVerdict]]] = {c: [] for c in self._weights}
        unscored_agents: List[Tuple[str, AgentVerdict]] = []

        for agent, v in parsed.items():
            category = v.category or self.agent_category(agent)
            if category is None or category not in by_category:
                unscored_agents.append((agent, v))
                continue
            by_category[category].append((agent, v))

        return parsed, by_category, unscored_agents

    def _compute_category_aggregates(
        self,
        by_category: Mapping[Category, List[Tuple[str, AgentVerdict]]],
    ) -> Tuple[Dict[Category, float], Dict[Category, Sentiment]]:
        category_scores: Dict[Category, float] = {}
        category_sentiments: Dict[Category, Sentiment] = {}
        for cat, items in by_category.items():
            if not items:
                continue
            # Weight by confidence — agents with no data (confidence=0) are excluded
            confident_items = [(n, v) for n, v in items if getattr(v, 'confidence', 1.0) > 0.1]
            if not confident_items:
                confident_items = items  # fallback to all if none are confident
            avg = sum(v.score for _, v in confident_items) / len(confident_items)
            category_scores[cat] = avg
            category_sentiments[cat] = self._sentiment_from_score(avg)
        return category_scores, category_sentiments

    def _scorable_agent_verdicts(self, parsed: Mapping[str, AgentVerdict]) -> Dict[str, AgentVerdict]:
        """Return only agent verdicts that map to a known, weighted category."""

        scored: Dict[str, AgentVerdict] = {}
        for agent, v in parsed.items():
            category = v.category or self.agent_category(agent)
            if category is None:
                continue
            if category in self._weights:
                scored[agent] = v
        return scored

    def score(
        self,
        verdicts: Mapping[str, Mapping[str, object] | AgentVerdict],
        *,
        title: str = "Token",
        final_floor: Optional[float] = None,
    ) -> ScoringResult:
        """Score a token based on agent verdicts.

        Input format:
            verdicts: dict of agent_name -> {score: 0-10, sentiment: ..., reasoning: ...}

        Returns:
            ScoringResult including the final score, confidence, and a formatted summary.
        """

        parsed, by_category, unscored_agents = self._group_verdicts(verdicts)
        category_scores, category_sentiments = self._compute_category_aggregates(by_category)

        # In "neutral" mode, missing categories are treated as a neutral 5/10.
        if self._missing_policy == "neutral":
            for cat in self._weights:
                if cat not in category_scores:
                    category_scores[cat] = 5.0
                    category_sentiments[cat] = "neutral"

        used_weights = self._compute_used_weights(category_scores)
        final_score = 0.0
        for cat, w in used_weights.items():
            final_score += w * category_scores[cat]

        # Optional external floor (e.g., whitelist boost). This is intentionally applied
        # *after* category aggregation to keep the engine transparent.
        if final_floor is not None:
            try:
                final_floor_f = float(final_floor)
            except Exception:
                final_floor_f = None  # type: ignore[assignment]
            if final_floor_f is not None:
                final_score = max(final_score, final_floor_f)

        final_score = round(self._clamp_score(final_score), 2)

        final_sentiment = self._sentiment_from_score(final_score)
        confidence = self.confidence_score(parsed)

        summary = self._build_summary(
            title=title,
            final_score=final_score,
            final_sentiment=final_sentiment,
            confidence=confidence,
            category_scores=category_scores,
            category_sentiments=category_sentiments,
            used_weights=used_weights,
            by_category=by_category,
            unscored_agents=unscored_agents,
        )

        return ScoringResult(
            final_score=final_score,
            final_sentiment=final_sentiment,
            confidence=confidence,
            category_scores=category_scores,
            category_sentiments=category_sentiments,
            used_weights=used_weights,
            summary=summary,
        )

    def _compute_used_weights(self, category_scores: Mapping[Category, float]) -> Dict[Category, float]:
        if self._missing_policy == "neutral":
            # Treat missing categories as score=5 (handled in scoring stage by adding
            # missing cats). Here, we just use original weights.
            return dict(self._weights)

        # renormalize
        present = [c for c in self._weights if c in category_scores]
        if not present:
            raise ValueError("No scorable categories present in verdicts")
        total_present = sum(self._weights[c] for c in present)
        if total_present <= 0:
            raise ValueError("Total weight of present categories must be > 0")
        return {c: self._weights[c] / total_present for c in present}

    def _parse_verdict(self, agent: str, payload: Mapping[str, object] | AgentVerdict) -> AgentVerdict:
        if isinstance(payload, AgentVerdict):
            v = payload
        else:
            score = float(payload.get("score", 5.0))  # type: ignore[arg-type]
            sentiment = payload.get("sentiment", None)  # type: ignore[assignment]
            reasoning = str(payload.get("reasoning", "")).strip()  # type: ignore[arg-type]
            category = payload.get("category", None)  # type: ignore[assignment]

            v = AgentVerdict(
                score=score,
                sentiment=sentiment if sentiment in ("bullish", "bearish", "neutral") else "neutral",
                reasoning=reasoning,
                category=category if category in self._weights else None,
            )

        clamped = self._clamp_score(v.score)
        if clamped != v.score:
            v = AgentVerdict(score=clamped, sentiment=v.sentiment, reasoning=v.reasoning, category=v.category)

        return v

    @staticmethod
    def _format_reason(agent: str, verdict: AgentVerdict) -> str:
        reason = verdict.reasoning.strip() or "(no reasoning provided)"
        return f"- {agent} ({verdict.sentiment}, {verdict.score:.1f}/10): {reason}"

    def _build_summary(
        self,
        *,
        title: str,
        final_score: float,
        final_sentiment: Sentiment,
        confidence: float,
        category_scores: Mapping[Category, float],
        category_sentiments: Mapping[Category, Sentiment],
        used_weights: Mapping[Category, float],
        by_category: Mapping[Category, List[Tuple[str, AgentVerdict]]],
        unscored_agents: Iterable[Tuple[str, AgentVerdict]],
    ) -> str:
        lines: List[str] = []
        lines.append(f"VerdictSwarm — {title}")
        lines.append(f"Final score: {final_score:.2f}/10 ({final_sentiment})")
        lines.append(f"Confidence: {confidence:.2f}")
        lines.append("")

        # Category breakdown
        lines.append("Category breakdown:")
        for cat in ("Technical", "Safety", "Tokenomics", "Social", "Macro"):
            c = cat  # type: ignore[assignment]
            if c in category_scores:
                w = used_weights.get(c, 0.0)
                lines.append(
                    f"- {c}: {category_scores[c]:.2f}/10 ({category_sentiments.get(c, 'neutral')}); weight used {w:.2%}"
                )
            else:
                if self._missing_policy == "neutral":
                    lines.append(f"- {c}: 5.00/10 (neutral); weight {self._weights[c]:.2%} (missing → neutral)")
                else:
                    lines.append(f"- {c}: (no verdicts)")

        lines.append("")

        # Agent details
        lines.append("Agent verdicts:")
        for cat in ("Technical", "Safety", "Tokenomics", "Social", "Macro"):
            c = cat  # type: ignore[assignment]
            items = by_category.get(c, [])
            if not items:
                continue
            lines.append(f"{c}:")
            for agent, v in items:
                lines.append(self._format_reason(agent, v))

        # Unscored
        unscored = list(unscored_agents)
        if unscored:
            lines.append("")
            lines.append("Additional notes (not directly weighted):")
            for agent, v in unscored:
                lines.append(self._format_reason(agent, v))

        return "\n".join(lines)


def _example_usage() -> None:
    """Run an end-to-end example with mock data."""

    engine = ScoringEngine(
        # Leave defaults, but map DevilsAdvocate to no category so it appears as
        # "not directly weighted" in the summary.
        agent_category_map={
            "TechnicianBot": "Technical",
            "TokenomicsBot": "Tokenomics",
            "SecurityBot": "Safety",
            "SocialBot": "Social",
            "MacroBot": "Macro",
        }
    )

    verdicts = {
        "TechnicianBot": {
            "score": 7.8,
            "sentiment": "bullish",
            "reasoning": "Uptrend intact; strong support reclaimed; volume confirmation on breakout.",
        },
        "TokenomicsBot": {
            "score": 6.4,
            "sentiment": "neutral",
            "reasoning": "Emissions are moderate; vesting schedule is acceptable but still adds sell pressure.",
        },
        "SecurityBot": {
            "score": 8.6,
            "sentiment": "bullish",
            "reasoning": "No critical audit findings; admin keys are time-locked; contract ownership renounced.",
        },
        "SocialBot": {
            "score": 5.9,
            "sentiment": "neutral",
            "reasoning": "Engagement is steady but growth has slowed; influencer interest is mixed.",
        },
        "MacroBot": {
            "score": 4.8,
            "sentiment": "neutral",
            "reasoning": "Risk-on conditions are weakening; BTC dominance rising; liquidity tightening.",
        },
        "DevilsAdvocate": {
            "score": 3.2,
            "sentiment": "bearish",
            "reasoning": "Narrative may be overheated; token distribution could amplify volatility during drawdowns.",
        },
    }

    result = engine.score(verdicts, title="$EXAMPLE")

    print(result.summary)


if __name__ == "__main__":
    _example_usage()
