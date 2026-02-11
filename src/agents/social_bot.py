"""SocialBot — social/sentiment analysis.

Uses Grok (xAI) when configured to produce *AI-native* social insights:
- Sentiment + key narratives
- Signs of coordinated/bot activity (heuristic via LLM)

Degrades gracefully to neutral if the API is not configured or fails.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Tuple

try:
    from ..scoring_engine import AgentVerdict  # type: ignore
    from ..data_fetcher import TokenData  # type: ignore
except ImportError:  # pragma: no cover
    from scoring_engine import AgentVerdict
    from data_fetcher import TokenData

from .ai_client import AIClient
from .base_agent import BaseAgent
from .prompts import SOCIAL_SYSTEM, SOCIAL_USER_TEMPLATE

logger = logging.getLogger(__name__)


class SocialBot(BaseAgent):
    """Analyzes social sentiment and community activity (via Grok)."""

    @property
    def name(self) -> str:  # noqa: D401
        return "SocialBot"

    @property
    def category(self) -> str:  # noqa: D401
        return "Social"

    @property
    def description(self) -> str:  # noqa: D401
        return "Social sentiment/community activity checks (Grok 3)."

    def _brave_presearch(self, symbol: str, name: str) -> str:
        """Run sync web searches for news + whale activity, return formatted context.
        
        Uses Brave Search API if key is available, otherwise Google News RSS (no key needed).
        """
        import os
        import re
        import httpx

        api_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
        brave_url = "https://api.search.brave.com/res/v1/web/search"

        queries = [
            f"{symbol} {name} crypto news",
            f"{symbol} whale dump sold transfer",
            f"{symbol} Arthur Hayes Justin Sun whale",
            f"{symbol} Lookonchain Arkham",
        ]

        all_items = []

        if api_key:
            # Brave Search path
            headers = {"Accept": "application/json", "X-Subscription-Token": api_key}
            with httpx.Client(timeout=5.0) as client:
                for q in queries:
                    time.sleep(0.3)
                    try:
                        resp = client.get(brave_url, params={"q": q, "count": 5, "freshness": "pw"}, headers=headers)
                        resp.raise_for_status()
                        for item in resp.json().get("web", {}).get("results", [])[:5]:
                            title = item.get("title", "").strip()
                            snippet = re.sub(r"<[^>]+>", "", item.get("description", "")).strip()
                            age = item.get("age", "") or item.get("page_age", "")
                            if title:
                                all_items.append((title, snippet[:300], str(age)))
                    except Exception as e:
                        print(f"[SocialBot] Brave search failed for '{q}': {e}")
        else:
            # Google News RSS fallback (no API key needed)
            import time as _t
            _presearch_start = _t.monotonic()
            print("[SocialBot] No BRAVE_SEARCH_API_KEY — using Google News RSS fallback")
            gnews_url = "https://news.google.com/rss/search"
            with httpx.Client(timeout=4.0, follow_redirects=True) as client:
                for q in queries:
                    # Hard cap: 10s total for all queries
                    if _t.monotonic() - _presearch_start > 10.0:
                        print(f"[SocialBot] Pre-search time budget exceeded, stopping after {len(all_items)} items")
                        break
                    try:
                        time.sleep(0.3)
                        resp = client.get(gnews_url, params={"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"})
                        resp.raise_for_status()
                        xml = resp.text
                        import xml.etree.ElementTree as ET
                        # Simple RSS parse
                        items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
                        for item_xml in items[:5]:
                            title_m = re.search(r'<title>(.*?)</title>', item_xml)
                            pub_m = re.search(r'<pubDate>(.*?)</pubDate>', item_xml)
                            title = title_m.group(1).strip() if title_m else ""
                            title = re.sub(r'<[^>]+>', '', title).replace('&amp;', '&').replace('&#39;', "'")
                            pub = pub_m.group(1).strip() if pub_m else ""
                            if title:
                                all_items.append((title, "", pub))
                    except Exception as e:
                        print(f"[SocialBot] Google News search failed for '{q}': {e}")

        if not all_items:
            print("[SocialBot] No pre-search results found")
            return ""

        # Deduplicate by title prefix
        seen = set()
        unique = []
        for title, snippet, age in all_items:
            key = title.lower()[:60]
            if key not in seen:
                seen.add(key)
                unique.append((title, snippet, age))

        lines = ["═══ RECENT NEWS & WHALE ACTIVITY (Web Search Results) ═══", ""]
        for i, (title, snippet, age) in enumerate(unique[:10], 1):
            lines.append(f"{i}. {title}")
            if snippet:
                lines.append(f"   {snippet}")
            lines.append("")
        lines.append(
            "⚠️ If ANY results mention whale dumps, notable figure selling/buying, "
            "hacks, or major events — this MUST be reflected in your score and summary. "
            "Whale dumping = bearish signal, score should be lower.\n"
            "═══ END SEARCH CONTEXT ═══\n"
        )

        print(f"[SocialBot] Injected {len(unique)} pre-search results")
        return "\n".join(lines)

    def _fetch_social_insights(self, symbol: str, name: str, token_data=None) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("xai", self.model_for("xai") or "")
        if provider != "xai":
            print(f"[WARN] SocialBot routed to provider={provider} model={model or '(default)'} instead of xai (Grok)")
        else:
            print(f"[INFO] SocialBot using provider={provider} model={model or '(default)'}")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        sym = (symbol or "").strip()
        nm = (name or "").strip() or sym or "the token"

        system = str(SOCIAL_SYSTEM)

        # Build search context for Grok
        contract = getattr(token_data, "contract_address", "")
        twitter_url = getattr(token_data, "twitter", "") or getattr(token_data, "twitter_url", "")
        website = getattr(token_data, "website", "") or getattr(token_data, "website_url", "")
        mcap = float(token_data.mcap or 0.0)

        # Build multiple search terms for better coverage
        # Include both raw data fetcher name AND preprocessor project name
        search_terms = [f"${sym}", nm]
        if nm.lower() != sym.lower():
            search_terms.append(sym)
        # Add preprocessor project name if different (e.g. "Ethena" vs "Staked ENA")
        facts = getattr(token_data, "preprocessed_facts", None)
        if facts:
            proj_name = getattr(facts, "project_name", "") or ""
            if proj_name and proj_name.lower() not in [t.lower() for t in search_terms]:
                search_terms.append(proj_name)
        # Deduplicate
        seen = set()
        unique_terms = []
        for t in search_terms:
            tl = t.lower()
            if tl not in seen:
                seen.add(tl)
                unique_terms.append(t)
        search_terms = unique_terms

        user = (
            f"Analyze CURRENT X/Twitter sentiment for {nm} (${sym}).\n\n"
            f"Token info: MCap ${mcap:,.0f}, Contract: {contract[:20]}...\n"
            f"Official Twitter: {twitter_url or 'unknown'}\n"
            f"Website: {website or 'unknown'}\n\n"
            f"SEARCH TERMS — search X for ALL of these: {', '.join(search_terms)}\n\n"
            "MANDATORY SEARCHES — You MUST execute these searches before writing ANY response:\n"
            f"  Search 1: '{sym} whale' OR '{nm} whale' — check for large wallet movements\n"
            f"  Search 2: '{sym} Arthur Hayes' OR '{sym} dump' OR '{sym} sold' — check notable figures\n"
            f"  Search 3: '{sym} hack' OR '{sym} exploit' OR '{sym} news' — check breaking events\n"
            f"  Search 4: '{nm} Lookonchain' OR '{nm} Arkham' — check on-chain tracker alerts\n"
            "For EACH search, report what you found or explicitly state 'searched, nothing found'.\n\n"
            "PRIORITY ORDER (most important first):\n"
            "1) WHALE/NOTABLE FIGURE ACTIVITY (last 7 days): Did Arthur Hayes, Justin Sun, Jump Trading, Wintermute, Alameda, or any whale wallet buy/sell/transfer this token? Check Lookonchain, Arkham, SpotOnChain alerts. If found, this MUST be the FIRST thing in your summary and MUST significantly impact the score.\n"
            "2) BREAKING NEWS (last 48h): hacks, exploits, delistings, partnerships, major announcements\n"
            "3) SENTIMENT SHIFTS: price-moving events, controversies, FUD, euphoria\n"
            "4) General community sentiment (least important)\n\n"
            "If notable figures are dumping a token, the score should be 3-5/10 MAX regardless of general sentiment.\n"
            "DO NOT say 'no breaking news found' unless you have actually searched all 4 search sets above.\n\n"
            "Return JSON:\n"
            "{\n"
            "  score: number (1-10, 1=dead/toxic community, 10=thriving organic),\n"
            "  sentiment: 'bullish'|'neutral'|'bearish',\n"
            "  summary: string (2-3 sentences — MUST mention any breaking news/whale activity first),\n"
            "  breaking_news: string[] (any major events in last 48h — empty array if none),\n"
            "  narratives: string[] (top 3 themes),\n"
            "  notable_mentions: string[] (top 3 notable accounts),\n"
            "  fake_engagement_risk: number (0-100),\n"
            "  coordination_signals: string[] (evidence of bots/coordination),\n"
            "  community_health: string (1 sentence),\n"
            "  confidence: number (0-1)\n"
            "}\n"
            + (SOCIAL_USER_TEMPLATE if SOCIAL_USER_TEMPLATE else
               "If you cannot find recent data, score 5/10 with low confidence.")
        )


        # Pre-search: inject real web search results so Grok has concrete data
        try:
            search_context = self._brave_presearch(sym, nm)
            if search_context:
                user = search_context + user
        except Exception as e:
            print(f"[SocialBot] Pre-search failed (non-fatal): {type(e).__name__}: {e}")

        user = self._prepend_fact_sheet(token_data, user)

        time.sleep(0.5)
        out = client.chat_json(
            provider=provider,
            model=model or None,
            system=system,
            user=user,
            temperature=0.2,
            max_output_tokens=1200,
        )

        # Normalize basics for safety.
        score = float(out.get("score", 5.0))
        score = max(1.0, min(10.0, score))
        sentiment = str(out.get("sentiment", "neutral")).strip().lower()
        if sentiment not in {"bullish", "neutral", "bearish"}:
            sentiment = "neutral"

        out["score"] = score
        out["sentiment"] = sentiment
        return out

    def analyze(self, token_data: TokenData) -> AgentVerdict:
        with self.timed("social.analyze") as t:
            score = 5.0
            sentiment = "neutral"
            summary = ""
            notes: list[str] = ["X/Twitter sentiment (Grok)"]

            try:
                out = self._fetch_social_insights(token_data.symbol, token_data.name, token_data)
                score = float(out.get("score", score))
                sentiment = str(out.get("sentiment", sentiment))
                summary = str(out.get("summary", "")).strip()

                breaking = out.get("breaking_news", None)
                fake_risk = out.get("fake_engagement_risk", None)
                narratives = out.get("narratives", None)
                coord = out.get("coordination_signals", None)
                conf = out.get("confidence", None)

                if isinstance(breaking, list) and breaking:
                    notes.append("⚠️ BREAKING: " + "; ".join(str(x) for x in breaking[:3]))
                if summary:
                    notes.append(summary)
                if isinstance(narratives, list) and narratives:
                    notes.append("narratives: " + ", ".join(str(x) for x in narratives[:3]))
                if fake_risk is not None:
                    notes.append(f"fake/coordination risk: {float(fake_risk):.0f}/100")
                if isinstance(coord, list) and coord:
                    notes.append("signals: " + ", ".join(str(x) for x in coord[:3]))
                if conf is not None:
                    notes.append(f"confidence {float(conf):.2f}")
            except Exception as e:
                print(f"[ERROR] SocialBot AI call failed: {type(e).__name__}: {e}")
                notes.append(f"AI social unavailable ({type(e).__name__})")

            # timing tracked via SSE events, not in reasoning text

            ai_worked = not any("AI social unavailable" in n for n in notes)
            fallback_conf = 0.3 if not ai_worked else 0.0
            return AgentVerdict(
                score=score,
                sentiment=sentiment,
                reasoning="; ".join(n for n in notes if n),
                category="Social",
                confidence=float(conf) if ai_worked and conf is not None else fallback_conf,
            )


def _mock_social_score(_: TokenData) -> Tuple[float, list[str]]:  # pragma: no cover
    return 5.0, ["Social checks", "social integrations not enabled"]


__all__ = ["SocialBot"]
