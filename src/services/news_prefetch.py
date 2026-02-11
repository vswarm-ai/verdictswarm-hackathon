"""News pre-fetch service for VerdictSwarm.

Runs a quick web search before agents execute, injecting recent news
context into every agent's prompt. This fixes the #1 quality issue:
agents being blind to breaking news (crashes, whale dumps, hacks, etc.).

Cost: ~$0.00 (Brave Search API is free tier / very cheap)
Latency: ~200-500ms per search
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import List, Optional

import httpx

BRAVE_API_KEY = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"


@dataclass
class NewsItem:
    title: str
    snippet: str
    url: str
    age: str = ""  # e.g. "2 hours ago"


@dataclass
class NewsPrefetchResult:
    """Structured news context to inject into agent prompts."""
    token_name: str
    token_symbol: str
    items: List[NewsItem] = field(default_factory=list)
    query_used: str = ""
    error: Optional[str] = None

    @property
    def has_news(self) -> bool:
        return len(self.items) > 0

    def format_for_prompt(self, max_items: int = 5) -> str:
        """Format news items as context block for agent prompts."""
        if not self.items:
            return ""

        lines = [
            "═══ BREAKING NEWS & RECENT EVENTS ═══",
            f"(Web search results for: {self.query_used})",
            "",
        ]
        for i, item in enumerate(self.items[:max_items], 1):
            age_str = f" ({item.age})" if item.age else ""
            lines.append(f"{i}. {item.title}{age_str}")
            if item.snippet:
                # Clean snippet
                snippet = item.snippet.strip()
                if len(snippet) > 250:
                    snippet = snippet[:247] + "..."
                lines.append(f"   {snippet}")
            lines.append("")

        lines.append(
            "⚠️ INSTRUCTION: Incorporate relevant news into your analysis. Guidelines:\n"
            "- Include genuinely breaking news (last 48h events) in your 'thesis' or 'reasoning'\n"
            "- Add news-related items to your 'key_risks' array when they represent NEW developments\n"
            "- If a notable figure (whale, founder, exchange) is buying/selling, mention them BY NAME\n"
            "- CRITICAL DISTINCTION: 'Down X% from all-time high' is NOT breaking news — most tokens\n"
            "  are down significantly from ATH in bear markets. Only flag ATH-distance if the drop is\n"
            "  RECENT (last 7 days). A gradual decline over months is background context, not a crisis.\n"
            "- Focus on ACTIONABLE events: sudden crashes, whale dumps TODAY, hacks, delistings, exploits\n"
            "- Do NOT let clickbait headlines dominate your analysis over on-chain data and fundamentals\n"
            "- DO NOT ignore genuinely breaking news. Reports that miss real events lose credibility."
        )
        lines.append("═══ END NEWS CONTEXT ═══")
        return "\n".join(lines)

    def format_whale_context(self, max_items: int = 8) -> str:
        """Format whale/notable figure search results for SocialBot."""
        if not self.items:
            return ""
        lines = [
            "═══ WHALE & NOTABLE FIGURE ACTIVITY (Web Search Results) ═══",
            "",
        ]
        for i, item in enumerate(self.items[:max_items], 1):
            age_str = f" ({item.age})" if item.age else ""
            lines.append(f"{i}. {item.title}{age_str}")
            if item.snippet:
                snippet = item.snippet.strip()[:300]
                lines.append(f"   {snippet}")
            lines.append("")
        lines.append(
            "⚠️ If ANY of these results mention whale dumps, notable figure selling, "
            "or large transfers, this MUST be reflected in your score and summary.\n"
            "═══ END WHALE CONTEXT ═══"
        )
        return "\n".join(lines)


async def _search_google_news_rss(query: str) -> List[dict]:
    """Fallback search via Google News RSS (no API key needed, reliable from servers)."""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://news.google.com/rss/search",
                params={
                    "q": query,
                    "hl": "en-US",
                    "gl": "US",
                    "ceid": "US:en",
                },
            )
            resp.raise_for_status()
            xml = resp.text

        results = []
        # Parse RSS items — <item><title>...</title><description>...</description><link>...</link></item>
        items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
        for item_xml in items[:10]:
            title_m = re.search(r'<title>(.*?)</title>', item_xml)
            desc_m = re.search(r'<description>(.*?)</description>', item_xml)
            link_m = re.search(r'<link>(.*?)</link>', item_xml)
            pub_m = re.search(r'<pubDate>(.*?)</pubDate>', item_xml)

            title = title_m.group(1).strip() if title_m else ""
            description = desc_m.group(1).strip() if desc_m else ""
            url = link_m.group(1).strip() if link_m else ""
            pub_date = pub_m.group(1).strip() if pub_m else ""

            # Clean HTML entities and tags
            title = re.sub(r'<[^>]+>', '', title)
            title = title.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'")
            description = re.sub(r'<[^>]+>', '', description)
            description = description.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'")

            if title:
                results.append({
                    "title": title,
                    "description": description or title,
                    "url": url,
                    "age": pub_date,
                })
        return results
    except Exception as e:
        print(f"[NEWS] Google News RSS fallback failed: {e}")
        return []


async def prefetch_news(
    token_name: str,
    token_symbol: str,
    chain: str = "",
    extra_terms: str = "",
) -> NewsPrefetchResult:
    """Search the web for recent news about a token.

    Uses Brave Search API if key is available, falls back to DuckDuckGo.

    Args:
        token_name: Full token name (e.g. "Wrapped BTC")
        token_symbol: Token symbol (e.g. "WBTC")
        chain: Chain name for context
        extra_terms: Additional search terms

    Returns:
        NewsPrefetchResult with news items or error
    """
    result = NewsPrefetchResult(token_name=token_name, token_symbol=token_symbol)

    use_brave = bool(BRAVE_API_KEY)

    # Build search query — use symbol + name + "crypto news"
    # For wrapped tokens, also search the underlying
    query_parts = []

    # Primary: symbol
    if token_symbol:
        query_parts.append(token_symbol)

    # Add name if it's different from symbol and not too generic
    if token_name and token_name.lower() != token_symbol.lower():
        # Skip generic wrapper prefixes for search
        clean_name = token_name
        for prefix in ("Wrapped ", "Staked "):
            if clean_name.startswith(prefix):
                # Also search the underlying asset
                underlying = clean_name[len(prefix):]
                if underlying and underlying not in query_parts:
                    query_parts.append(underlying)
                break
        if clean_name not in query_parts:
            query_parts.append(clean_name)

    if extra_terms:
        query_parts.append(extra_terms)

    query_parts.append("crypto news")

    query = " ".join(query_parts)
    result.query_used = query

    try:
        raw_results = []

        if use_brave:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    BRAVE_SEARCH_URL,
                    params={
                        "q": query,
                        "count": 8,
                        "freshness": "pw",  # past week
                    },
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip",
                        "X-Subscription-Token": BRAVE_API_KEY,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            raw_results = data.get("web", {}).get("results", [])
        else:
            # Fallback to Google News RSS (reliable from servers, no API key)
            raw_results = await _search_google_news_rss(query)

        for item in raw_results[:8]:
            title = item.get("title", "").strip()
            description = item.get("description", "").strip()
            url = item.get("url", "")
            age = item.get("age", "") or item.get("page_age", "")

            if not title or not description:
                continue

            # Clean HTML tags from description
            description = re.sub(r"<[^>]+>", "", description)

            result.items.append(NewsItem(
                title=title,
                snippet=description,
                url=url,
                age=str(age),
            ))

    except httpx.TimeoutException:
        result.error = "Search timed out (5s)"
        print(f"[NEWS] Search timed out for: {query}")
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)[:100]}"
        print(f"[NEWS] Search failed for {query}: {e}")

    return result


async def prefetch_whale_activity(
    token_name: str,
    token_symbol: str,
) -> NewsPrefetchResult:
    """Search specifically for whale/notable figure activity around a token.

    Runs multiple targeted searches to catch whale dumps, notable figure trades,
    and on-chain tracker alerts that general news searches miss.
    """
    result = NewsPrefetchResult(token_name=token_name, token_symbol=token_symbol)

    # Multiple targeted queries for whale activity
    queries = [
        f"{token_symbol} whale dump OR sold OR transfer",
        f"{token_symbol} Arthur Hayes OR Justin Sun OR Jump Trading",
        f"{token_symbol} Lookonchain OR Arkham OR SpotOnChain",
    ]

    use_brave = bool(BRAVE_API_KEY)
    all_items = []

    for query in queries:
        try:
            if use_brave:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        BRAVE_SEARCH_URL,
                        params={"q": query, "count": 5, "freshness": "pw"},
                        headers={
                            "Accept": "application/json",
                            "Accept-Encoding": "gzip",
                            "X-Subscription-Token": BRAVE_API_KEY,
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                raw_results = data.get("web", {}).get("results", [])
            else:
                raw_results = await _search_google_news_rss(query)

            for item in raw_results[:5]:
                title = item.get("title", "").strip()
                description = item.get("description", "").strip()
                url = item.get("url", "")
                age = item.get("age", "") or item.get("page_age", "")
                if not title:
                    continue
                description = re.sub(r"<[^>]+>", "", description)
                all_items.append(NewsItem(
                    title=title,
                    snippet=description,
                    url=url,
                    age=str(age),
                ))
        except Exception as e:
            print(f"[NEWS] Whale search failed for '{query}': {e}")

    # Deduplicate by title similarity
    seen_titles = set()
    for item in all_items:
        title_key = item.title.lower()[:60]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            result.items.append(item)

    result.query_used = " | ".join(queries)
    return result
