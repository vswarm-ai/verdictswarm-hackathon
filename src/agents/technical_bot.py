"""TechnicalBot - Technical Analysis Agent (AI-enhanced).

This module contains a richer technical analysis engine (alpha-tier). The
original heuristic indicator logic remains, but when an ``AIClient`` is
available the bot will use Gemini to:
- Perform chart/pattern interpretation from summarized OHLCV
- Interpret indicator confluence and give human-readable reasoning

If Gemini isn't configured, the bot falls back to heuristic-only signals.

CONFIDENTIAL - Do not share implementation details publicly.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from .ai_client import AIClient


class TrendDirection(Enum):
    """Market trend direction."""

    STRONG_BULLISH = "strong_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    STRONG_BEARISH = "strong_bearish"


class SignalStrength(Enum):
    """Strength of a technical signal."""

    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"


@dataclass
class TechnicalSignal:
    """Individual technical signal."""

    indicator: str
    signal_type: str  # "bullish", "bearish", "neutral"
    strength: SignalStrength
    value: float
    description: str


@dataclass
class TechnicalAnalysis:
    """Result of technical analysis."""

    technical_score: float  # 0-100
    trend: TrendDirection
    signals: List[TechnicalSignal]
    support_levels: List[float]
    resistance_levels: List[float]
    recommendation: str  # "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"
    summary: str


class TechnicalBot:
    """Specialized agent for technical analysis.

    NOTE: This bot is currently not wired into the default CLI pipeline, but we
    keep its LLM plumbing compatible with the shared router.
    """

    def __init__(
        self,
        config: Optional[Dict] = None,
        *,
        ai_client: Optional[AIClient] = None,
        provider_model: Optional[tuple[str, str]] = None,
        model_overrides: Optional[Dict[str, str]] = None,
    ):
        self.config = config or {}
        self.ai_client = ai_client
        self._provider_model = tuple(provider_model) if provider_model else None
        self._model_overrides = dict(model_overrides or {})
        self.name = "TechnicalBot"
        self.version = "1.1.0"
        self.tier = "alpha"  # Requires Alpha tier

    def model_for(self, provider: str) -> Optional[str]:
        return (self._model_overrides or {}).get(str(provider))

    def routed_provider_model(self) -> Optional[tuple[str, str]]:
        return self._provider_model

    async def analyze(self, token_data: Dict, price_data: Dict) -> TechnicalAnalysis:
        """Perform comprehensive technical analysis on a token."""

        signals: List[TechnicalSignal] = []

        # 1. Momentum Analysis
        momentum_signals = await self._analyze_momentum(price_data)
        signals.extend(momentum_signals)

        # 2. Trend Analysis
        trend_signals = await self._analyze_trend(price_data)
        signals.extend(trend_signals)

        # 3. Volume Analysis
        volume_signals = await self._analyze_volume(price_data)
        signals.extend(volume_signals)

        # 4. Support/Resistance
        support_levels, resistance_levels = await self._find_levels(price_data)

        # 5. Pattern Detection (heuristic placeholder)
        pattern_signals = await self._detect_patterns(price_data)
        signals.extend(pattern_signals)

        # Calculate overall score and recommendation
        technical_score = self._calculate_score(signals)
        trend = self._determine_trend(signals)
        recommendation = self._get_recommendation(technical_score, trend)
        summary = self._generate_summary(signals, trend, support_levels, resistance_levels)

        # 6. AI interpretation layer (optional)
        summary = await self._ai_interpretation(
            token_data=token_data,
            price_data=price_data,
            signals=signals,
            support_levels=support_levels,
            resistance_levels=resistance_levels,
            base_summary=summary,
        )

        return TechnicalAnalysis(
            technical_score=technical_score,
            trend=trend,
            signals=signals,
            support_levels=support_levels,
            resistance_levels=resistance_levels,
            recommendation=recommendation,
            summary=summary,
        )

    async def _ai_interpretation(
        self,
        *,
        token_data: Dict,
        price_data: Dict,
        signals: List[TechnicalSignal],
        support_levels: List[float],
        resistance_levels: List[float],
        base_summary: str,
    ) -> str:
        """AI layer to interpret confluence + identify patterns from summarized OHLCV."""

        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("gemini", self.model_for("gemini") or "")
        if not client.has_provider(provider):
            return base_summary

        closes: List[float] = list(price_data.get("closes", []) or [])
        highs: List[float] = list(price_data.get("highs", []) or [])
        lows: List[float] = list(price_data.get("lows", []) or [])
        volumes: List[float] = list(price_data.get("volumes", []) or [])

        # Summaries to keep payload small.
        last_n = 60
        c_tail = closes[-last_n:] if len(closes) > last_n else closes
        h_tail = highs[-last_n:] if len(highs) > last_n else highs
        l_tail = lows[-last_n:] if len(lows) > last_n else lows
        v_tail = volumes[-last_n:] if len(volumes) > last_n else volumes

        system = (
            "You are a technical analyst specialized in crypto charts. "
            "You must be explicit about uncertainty and not hallucinate levels. "
            "Output MUST be valid JSON only (no markdown)."
        )

        user = (
            "Interpret the technical setup using the provided summarized OHLCV and computed signals.\n\n"
            f"Token meta: {token_data}\n\n"
            f"Recent closes (last {len(c_tail)}): {c_tail}\n"
            f"Recent highs (last {len(h_tail)}): {h_tail}\n"
            f"Recent lows (last {len(l_tail)}): {l_tail}\n"
            f"Recent volumes (last {len(v_tail)}): {v_tail}\n\n"
            f"Heuristic signals: {[s.__dict__ for s in signals]}\n"
            f"Support levels (heuristic/empty ok): {support_levels}\n"
            f"Resistance levels (heuristic/empty ok): {resistance_levels}\n\n"
            "Return JSON:\n"
            "{\n"
            "  narrative: string (2-4 sentences explaining confluence),\n"
            "  patterns: string[] (e.g., triangle, H&S, double top/bottom; only if plausible),\n"
            "  invalidation_levels: string[] (describe what would invalidate thesis),\n"
            "  confidence: number (0-1)\n"
            "}\n"
        )

        try:
            out = client.chat_json(
                provider=provider,
                model=model or None,
                system=system,
                user=user,
                temperature=0.2,
                max_output_tokens=650,
            )
            narrative = str(out.get("narrative", "")).strip()
            patterns = out.get("patterns", [])
            invalid = out.get("invalidation_levels", [])
            conf = out.get("confidence", None)

            parts: List[str] = [base_summary]
            if narrative:
                parts.append(narrative)
            if isinstance(patterns, list) and patterns:
                parts.append("patterns: " + ", ".join(str(x) for x in patterns[:4]))
            if isinstance(invalid, list) and invalid:
                parts.append("invalidation: " + ", ".join(str(x) for x in invalid[:3]))
            if conf is not None:
                parts.append(f"AI confidence {float(conf):.2f}")
            return " ".join(p for p in parts if p)
        except Exception:
            return base_summary

    async def _analyze_momentum(self, price_data: Dict) -> List[TechnicalSignal]:
        signals: List[TechnicalSignal] = []
        closes = price_data.get("closes", [])

        if len(closes) < 14:
            return signals

        # RSI
        rsi = self._calculate_rsi(closes, period=14)
        if rsi is not None:
            if rsi < 30:
                signals.append(
                    TechnicalSignal(
                        indicator="RSI",
                        signal_type="bullish",
                        strength=SignalStrength.STRONG if rsi < 20 else SignalStrength.MODERATE,
                        value=rsi,
                        description=f"RSI at {rsi:.1f} - Oversold conditions",
                    )
                )
            elif rsi > 70:
                signals.append(
                    TechnicalSignal(
                        indicator="RSI",
                        signal_type="bearish",
                        strength=SignalStrength.STRONG if rsi > 80 else SignalStrength.MODERATE,
                        value=rsi,
                        description=f"RSI at {rsi:.1f} - Overbought conditions",
                    )
                )

        # MACD
        macd_line, signal_line, histogram = self._calculate_macd(closes)
        if macd_line is not None:
            if histogram > 0 and macd_line > signal_line:
                signals.append(
                    TechnicalSignal(
                        indicator="MACD",
                        signal_type="bullish",
                        strength=SignalStrength.MODERATE,
                        value=histogram,
                        description="MACD bullish crossover",
                    )
                )
            elif histogram < 0 and macd_line < signal_line:
                signals.append(
                    TechnicalSignal(
                        indicator="MACD",
                        signal_type="bearish",
                        strength=SignalStrength.MODERATE,
                        value=histogram,
                        description="MACD bearish crossover",
                    )
                )

        return signals

    async def _analyze_trend(self, price_data: Dict) -> List[TechnicalSignal]:
        signals: List[TechnicalSignal] = []
        closes = price_data.get("closes", [])

        if len(closes) < 200:
            return signals

        # Moving Averages
        ma_20 = self._calculate_sma(closes, 20)
        ma_50 = self._calculate_sma(closes, 50)
        ma_200 = self._calculate_sma(closes, 200)

        current_price = closes[-1]

        # Price vs MAs
        if current_price > ma_20 > ma_50 > ma_200:
            signals.append(
                TechnicalSignal(
                    indicator="Moving Averages",
                    signal_type="bullish",
                    strength=SignalStrength.STRONG,
                    value=current_price,
                    description="Price above all major MAs - Strong uptrend",
                )
            )
        elif current_price < ma_20 < ma_50 < ma_200:
            signals.append(
                TechnicalSignal(
                    indicator="Moving Averages",
                    signal_type="bearish",
                    strength=SignalStrength.STRONG,
                    value=current_price,
                    description="Price below all major MAs - Strong downtrend",
                )
            )

        # Golden/Death Cross
        if ma_50 > ma_200 and self._calculate_sma(closes[:-1], 50) <= self._calculate_sma(closes[:-1], 200):
            signals.append(
                TechnicalSignal(
                    indicator="Golden Cross",
                    signal_type="bullish",
                    strength=SignalStrength.STRONG,
                    value=ma_50,
                    description="50 MA crossed above 200 MA - Golden Cross",
                )
            )

        return signals

    async def _analyze_volume(self, price_data: Dict) -> List[TechnicalSignal]:
        signals: List[TechnicalSignal] = []
        # TODO: Implement OBV, Volume Profile, VWAP
        return signals

    async def _find_levels(self, price_data: Dict) -> tuple:
        # TODO: Implement level detection algorithm
        return [], []

    async def _detect_patterns(self, price_data: Dict) -> List[TechnicalSignal]:
        signals: List[TechnicalSignal] = []
        # TODO: Implement pattern detection heuristics
        return signals

    def _calculate_rsi(self, closes: List[float], period: int = 14) -> Optional[float]:
        if len(closes) < period + 1:
            return None

        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]

        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period

        if avg_loss == 0:
            return 100

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def _calculate_macd(self, closes: List[float]) -> tuple:
        if len(closes) < 26:
            return None, None, None

        ema_12 = self._calculate_ema(closes, 12)
        ema_26 = self._calculate_ema(closes, 26)
        macd_line = ema_12 - ema_26

        # Simplified - would need full MACD series for proper signal line
        signal_line = macd_line * 0.9  # Placeholder
        histogram = macd_line - signal_line

        return macd_line, signal_line, histogram

    def _calculate_sma(self, data: List[float], period: int) -> float:
        if len(data) < period:
            return data[-1] if data else 0
        return sum(data[-period:]) / period

    def _calculate_ema(self, data: List[float], period: int) -> float:
        if len(data) < period:
            return data[-1] if data else 0

        multiplier = 2 / (period + 1)
        ema = sum(data[:period]) / period  # Start with SMA

        for price in data[period:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))

        return ema

    def _calculate_score(self, signals: List[TechnicalSignal]) -> float:
        if not signals:
            return 50

        score = 50

        for signal in signals:
            weight = 10 if signal.strength == SignalStrength.STRONG else 5 if signal.strength == SignalStrength.MODERATE else 2

            if signal.signal_type == "bullish":
                score += weight
            elif signal.signal_type == "bearish":
                score -= weight

        return max(0, min(100, score))

    def _determine_trend(self, signals: List[TechnicalSignal]) -> TrendDirection:
        bullish = sum(1 for s in signals if s.signal_type == "bullish")
        bearish = sum(1 for s in signals if s.signal_type == "bearish")

        diff = bullish - bearish

        if diff >= 3:
            return TrendDirection.STRONG_BULLISH
        if diff >= 1:
            return TrendDirection.BULLISH
        if diff <= -3:
            return TrendDirection.STRONG_BEARISH
        if diff <= -1:
            return TrendDirection.BEARISH
        return TrendDirection.NEUTRAL

    def _get_recommendation(self, score: float, trend: TrendDirection) -> str:
        if score >= 70 and trend in [TrendDirection.STRONG_BULLISH, TrendDirection.BULLISH]:
            return "STRONG_BUY"
        if score >= 55:
            return "BUY"
        if score <= 30 and trend in [TrendDirection.STRONG_BEARISH, TrendDirection.BEARISH]:
            return "STRONG_SELL"
        if score <= 45:
            return "SELL"
        return "HOLD"

    def _generate_summary(self, signals: List[TechnicalSignal], trend: TrendDirection, support: List[float], resistance: List[float]) -> str:
        trend_text = {
            TrendDirection.STRONG_BULLISH: "strongly bullish",
            TrendDirection.BULLISH: "bullish",
            TrendDirection.NEUTRAL: "neutral",
            TrendDirection.BEARISH: "bearish",
            TrendDirection.STRONG_BEARISH: "strongly bearish",
        }

        summary = f"Technical outlook is {trend_text[trend]}. "

        bullish_signals = [s for s in signals if s.signal_type == "bullish"]
        bearish_signals = [s for s in signals if s.signal_type == "bearish"]

        if bullish_signals:
            summary += f"Bullish signals: {', '.join(s.indicator for s in bullish_signals)}. "
        if bearish_signals:
            summary += f"Bearish signals: {', '.join(s.indicator for s in bearish_signals)}. "

        return summary


__all__ = ["TechnicalBot", "TechnicalAnalysis", "TechnicalSignal", "TrendDirection"]
