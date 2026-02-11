"""VerdictSwarm output formatters.

Provides different output formats for scoring results:
- CLI (detailed, for terminal)
- Tweet (compact, for X/Twitter)
- JSON (for API responses)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class FormattedScore:
    """Formatted scoring output."""
    
    name: str
    symbol: str
    chain: str
    address: str
    final_score: float
    sentiment: str
    confidence: float
    category_scores: Dict[str, float]
    category_reasoning: Dict[str, str]
    flags: List[str]
    scam_score: Optional[int] = None
    scam_signals: Optional[List[str]] = None
    legitimate_patterns: Optional[List[str]] = None


def sentiment_emoji(sentiment: str) -> str:
    """Get emoji for sentiment."""
    return {
        "bullish": "🟢",
        "neutral": "🟡", 
        "bearish": "🔴",
    }.get(sentiment.lower(), "⚪")


def score_bar(score: float, max_score: float = 10.0, width: int = 10) -> str:
    """Create a visual score bar."""
    filled = int((score / max_score) * width)
    return "█" * filled + "░" * (width - filled)


def format_tweet(result: FormattedScore) -> str:
    """Format for X/Twitter (280 char limit friendly).
    
    Example output:
    🔍 $VIRTUAL Analysis
    
    Score: 7.2/10 🟢
    ████████░░
    
    📊 Tech: 8 | 🔒 Safe: 7 | 💰 Token: 6
    🐦 Social: 8 | 🌍 Macro: 6
    
    ✅ Verified | LayerZero OFT
    ⚠️ 52% top holders
    
    verdictswarm.com
    """
    lines = []
    
    # Header
    lines.append(f"🔍 ${result.symbol} Analysis")
    lines.append("")
    
    # Score with emoji and bar
    emoji = sentiment_emoji(result.sentiment)
    lines.append(f"Score: {result.final_score:.1f}/10 {emoji}")
    lines.append(score_bar(result.final_score))
    lines.append("")
    
    # Category scores (compact)
    cats = result.category_scores
    line1 = f"📊 Tech: {cats.get('Technical', 5):.0f} | 🔒 Safe: {cats.get('Safety', 5):.0f} | 💰 Token: {cats.get('Tokenomics', 5):.0f}"
    line2 = f"🐦 Social: {cats.get('Social', 5):.0f} | 🌍 Macro: {cats.get('Macro', 5):.0f}"
    lines.append(line1)
    lines.append(line2)
    lines.append("")
    
    # Key flags (positive first, then warnings)
    flag_lines = []
    
    # Positive signals
    if result.legitimate_patterns:
        positives = []
        if "layerzero_oft" in result.legitimate_patterns:
            positives.append("LayerZero OFT")
        if "openzeppelin_standard" in result.legitimate_patterns:
            positives.append("OpenZeppelin")
        if "timelock_protected" in result.legitimate_patterns:
            positives.append("Timelocked")
        if positives:
            flag_lines.append(f"✅ {' | '.join(positives)}")
    
    # Warnings (max 2 for tweet)
    warnings = [f for f in result.flags if f.startswith("⚠️")][:2]
    flag_lines.extend(warnings)
    
    lines.extend(flag_lines[:3])  # Max 3 flag lines
    lines.append("")
    lines.append("verdictswarm.com")
    
    return "\n".join(lines)


def format_cli(result: FormattedScore) -> str:
    """Format for CLI (detailed output)."""
    width = 55
    border = "═" * width
    
    lines = [
        border,
        f" VERDICTSWARM ANALYSIS: {result.name} (${result.symbol})",
        f" Chain: {result.chain} | Contract: {result.address[:20]}...",
        border,
        "",
        f" FINAL SCORE: {result.final_score:.2f}/10 ({result.sentiment})",
        f" Confidence: {result.confidence:.0%}",
        f" {score_bar(result.final_score, width=20)}",
        "",
        " Category Breakdown:",
    ]
    
    # Category details
    cat_icons = {
        "Technical": "📊",
        "Safety": "🔒",
        "Tokenomics": "💰",
        "Social": "🐦",
        "Macro": "🌍",
    }
    
    for cat, score in result.category_scores.items():
        icon = cat_icons.get(cat, "•")
        reasoning = result.category_reasoning.get(cat, "")[:50]
        lines.append(f"   {icon} {cat:12} {score:5.2f}/10  {reasoning}")
    
    # Flags section
    if result.flags or result.scam_signals:
        lines.append("")
        lines.append(" Flags:")
        
        if result.scam_score is not None:
            risk = "HIGH" if result.scam_score >= 70 else "MEDIUM" if result.scam_score >= 40 else "LOW"
            lines.append(f"   🔍 ScamBot Risk: {risk} ({result.scam_score}/100)")
        
        if result.legitimate_patterns:
            lines.append(f"   ✅ Legitimate: {', '.join(result.legitimate_patterns)}")
        
        if result.scam_signals:
            for sig in result.scam_signals[:5]:
                lines.append(f"   ⚠️ {sig}")
        
        for flag in result.flags[:5]:
            if not flag.startswith("⚠️"):
                lines.append(f"   {flag}")
    
    lines.append("")
    lines.append(border)
    
    return "\n".join(lines)


def format_json(result: FormattedScore) -> Dict[str, Any]:
    """Format as JSON dict for API responses."""
    return {
        "token": {
            "name": result.name,
            "symbol": result.symbol,
            "chain": result.chain,
            "address": result.address,
        },
        "score": {
            "final": result.final_score,
            "sentiment": result.sentiment,
            "confidence": result.confidence,
        },
        "categories": result.category_scores,
        "reasoning": result.category_reasoning,
        "analysis": {
            "scam_score": result.scam_score,
            "scam_signals": result.scam_signals,
            "legitimate_patterns": result.legitimate_patterns,
            "flags": result.flags,
        },
    }
