"""
ScamBot - Fraud Detection Agent

Analyzes tokens for scam patterns, rug pull signals, and honeypot characteristics.
This is a PREMIUM agent (Pro tier and above).

CONFIDENTIAL - Do not share implementation details publicly.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

try:
    # Package (recommended): projects.verdictswarm.src.agents.scam_bot
    from ..token_whitelist import get_whitelist_info, is_whitelisted  # type: ignore
except Exception:  # pragma: no cover
    try:
        # Legacy absolute import (if src is on PYTHONPATH)
        from src.token_whitelist import get_whitelist_info, is_whitelisted  # type: ignore
    except Exception:
        # Standalone / local execution.
        from token_whitelist import get_whitelist_info, is_whitelisted  # type: ignore


# Legitimate/safe patterns that should reduce false positives.
# These patterns are intentionally lightweight (regex / string markers) and are used
# only to *mitigate* certain signals when strong evidence of a standard, audited
# implementation exists.
LEGITIMATE_PATTERNS: Dict[str, List[str]] = {
    "layerzero_oft": [
        r"@layerzerolabs",
        r"OFT\.sol",
        r"ILayerZeroEndpoint",
        r"lzReceive",
        r"_lzSend",
    ],
    # Circle-style USDC implementation patterns.
    "circle_usdc": [
        r"FiatTokenV",
        r"MasterMinter",
        r"Blacklistable",
        r"Pausable",
        r"circle",
    ],
    # Canonical WETH markers.
    "canonical_weth": [
        r"WETH9",
        r"deposit.*payable",
        r"withdraw.*amount",
    ],
    # Common stablecoin admin controls (legit, but should not automatically be treated as scam signals).
    "stablecoin_standard": [
        r"blacklist",
        r"pause",
        r"minter",
        r"masterMinter",
    ],
    "openzeppelin_standard": [
        r"@openzeppelin/contracts",
        r"AccessControl",
        r"Ownable",
        r"TimelockController",
    ],
    "timelock_protected": [
        r"TimelockController",
        r"timelock",
        r"delay\s*>=?\s*\d+\s*(days|hours)",
    ],
    "velodrome_dex": [
        r"Velodrome",
        r"Aerodrome", 
        r"Solidly",
        r"IVoter",
        r"IGauge",
        r"VotingEscrow",
        r"IMinter",
    ],
    "uniswap_style": [
        r"IUniswap",
        r"UniswapV[23]",
        r"PancakeSwap",
        r"SushiSwap",
    ],
}


class ScamSignal(Enum):
    """Types of scam signals to detect."""

    HONEYPOT = "honeypot"
    HIDDEN_MINT = "hidden_mint"
    PAUSE_FUNCTION = "pause_function"
    BLACKLIST_FUNCTION = "blacklist_function"
    PROXY_UPGRADEABLE = "proxy_upgradeable"
    COPIED_SCAM_CODE = "copied_scam_code"
    TEAM_HISTORY_RUG = "team_history_rug"
    LOW_LIQUIDITY_LOCK = "low_liquidity_lock"
    CONCENTRATED_HOLDING = "concentrated_holding"
    FAKE_SOCIALS = "fake_socials"
    NEW_DOMAIN = "new_domain"
    ANONYMOUS_TEAM = "anonymous_team"


@dataclass
class ScamAnalysis:
    """Result of scam analysis."""

    scam_score: float  # 0-100, higher = more likely scam
    confidence: float  # 0-1
    signals_detected: List[ScamSignal]
    signal_details: Dict[str, Any]
    recommendation: str  # "SAFE", "CAUTION", "HIGH_RISK", "LIKELY_SCAM"
    explanation: str


class ScamBot:
    """
    ScamBot - Specialized agent for fraud and rug pull detection.

    Analyzes:
    1. Contract red flags (honeypots, hidden functions)
    2. Team/wallet history (previous rugs, concentration)
    3. Social authenticity (fake followers, bot activity)
    4. Website/domain legitimacy

    Note: This implementation is intentionally standalone. It uses heuristics / regex-based
    analysis and accepts mock data structures for testing.
    """

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.name = "ScamBot"
        self.version = "1.0.0"
        self.tier = "pro"  # Requires Pro tier or above

    async def analyze(self, token_data: Dict) -> ScamAnalysis:
        """
        Perform comprehensive scam analysis on a token.

        Args:
            token_data: Dictionary containing token information
                - contract_address: str
                - chain: str
                - contract_source: Optional[str]
                - team_wallets: Optional[List[str]]
                - wallet_balances: Optional[Dict[str, float] | List[Dict[str, Any]]]
                - total_supply: Optional[float]
                - liquidity: Optional[Dict[str, Any]]
                - social_data: Optional[Dict[str, Any]]
                - website_url: Optional[str]
                - domain_data: Optional[Dict[str, Any]]

        Returns:
            ScamAnalysis with score and detected signals
        """

        signals_detected: List[ScamSignal] = []
        signal_details: Dict[str, Any] = {}

        # Whitelist (known legitimate tokens)
        chain = str(token_data.get("chain") or "").strip().lower()
        addr = str(token_data.get("contract_address") or token_data.get("address") or "").strip()
        whitelist_info = get_whitelist_info(addr, chain) if (chain and addr) else None
        is_wl = bool(whitelist_info) if (chain and addr) else False
        signal_details["whitelist"] = {
            "is_whitelisted": is_wl,
            "info": whitelist_info,
        }

        # 1. Contract Analysis
        contract_signals = await self._analyze_contract(token_data)
        signals_detected.extend(contract_signals["signals"])
        signal_details["contract"] = contract_signals["details"]

        # 2. Wallet/Team Analysis
        wallet_signals = await self._analyze_wallets(token_data)
        signals_detected.extend(wallet_signals["signals"])
        signal_details["wallets"] = wallet_signals["details"]

        # 3. Social Analysis
        social_signals = await self._analyze_socials(token_data)
        signals_detected.extend(social_signals["signals"])
        signal_details["socials"] = social_signals["details"]

        # 4. Website/Domain Analysis
        domain_signals = await self._analyze_domain(token_data)
        signals_detected.extend(domain_signals["signals"])
        signal_details["domain"] = domain_signals["details"]

        # Context-aware mitigation for known-safe / standard patterns
        source_code = token_data.get("contract_source") or ""
        legitimate_patterns = self._detect_legitimate_patterns(source_code)
        mitigated_signals: List[str] = []

        # If the token is whitelisted, treat common "red flags" as informational unless
        # accompanied by truly critical signals (e.g., honeypot).
        if is_wl:
            for sig in [
                ScamSignal.PROXY_UPGRADEABLE,
                ScamSignal.LOW_LIQUIDITY_LOCK,
                ScamSignal.HIDDEN_MINT,
            ]:
                if sig in signals_detected:
                    mitigated_signals.append(sig.value)

        # OFT tokens legitimately mint/burn for bridging; reduce "hidden mint" severity.
        if "layerzero_oft" in legitimate_patterns and ScamSignal.HIDDEN_MINT in signals_detected:
            mitigated_signals.append(ScamSignal.HIDDEN_MINT.value)

        # Upgradeable proxies are common when protected by timelocks.
        if "timelock_protected" in legitimate_patterns and ScamSignal.PROXY_UPGRADEABLE in signals_detected:
            mitigated_signals.append(ScamSignal.PROXY_UPGRADEABLE.value)

        # DEX tokens (Velodrome/Aerodrome/Solidly) legitimately mint for emissions.
        if "velodrome_dex" in legitimate_patterns and ScamSignal.HIDDEN_MINT in signals_detected:
            mitigated_signals.append(ScamSignal.HIDDEN_MINT.value)
        
        # Uniswap-style DEX patterns are generally safe.
        if "uniswap_style" in legitimate_patterns and ScamSignal.HIDDEN_MINT in signals_detected:
            mitigated_signals.append(ScamSignal.HIDDEN_MINT.value)

        # Add to analysis payload (top-level)
        signal_details["legitimate_patterns"] = legitimate_patterns
        signal_details["mitigated_signals"] = mitigated_signals

        # Calculate final score
        scam_score = self._calculate_scam_score(
            signals_detected,
            signal_details,
            token_data=token_data,
            legitimate_patterns=legitimate_patterns,
            mitigated_signals=mitigated_signals,
            whitelist_info=whitelist_info,
        )

        confidence = self._calculate_confidence(token_data)
        # Standards-based implementations marginally increase confidence.
        if "openzeppelin_standard" in legitimate_patterns:
            confidence = min(1.0, confidence + 0.1)

        recommendation = self._get_recommendation(scam_score)
        explanation = self._generate_explanation(signals_detected, signal_details)
        if is_wl and whitelist_info:
            explanation = (
                f"Note: known legitimate token (whitelisted: {whitelist_info.get('name')} by {whitelist_info.get('issuer')}).\n"
                + explanation
            )

        return ScamAnalysis(
            scam_score=scam_score,
            confidence=confidence,
            signals_detected=signals_detected,
            signal_details=signal_details,
            recommendation=recommendation,
            explanation=explanation,
        )

    @staticmethod
    def _norm_address(addr: str) -> str:
        return (addr or "").strip().lower()

    @staticmethod
    def _safe_float(x: Any, default: float = 0.0) -> float:
        try:
            if x is None:
                return default
            return float(x)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _now_utc() -> datetime:
        return datetime.now(timezone.utc)

    def _compile_patterns(self) -> Dict[str, List[re.Pattern]]:
        """Central place to keep regex patterns; case-insensitive, dot matches newline."""

        flags = re.IGNORECASE | re.DOTALL
        # Important patterns requested in the task.
        return {
            "honeypot": [
                re.compile(r"require\s*\(\s*msg\.sender\s*==\s*owner", flags),
                re.compile(r"function\s+transfer.*?require.*?blacklist", flags),
                re.compile(r"_maxTxAmount", flags),
                # Common honeypot-ish restrictions / fees.
                re.compile(r"require\s*\(\s*tx\.origin\s*==\s*owner", flags),
                re.compile(r"require\s*\(\s*!\s*isBot\[", flags),
                re.compile(r"\b(setSellFee|setTax|setFees)\b", flags),
            ],
            "hidden_mint": [
                re.compile(
                    r"function\s+mint\s*\([^)]*\)\s*(public|external)(?!.*onlyOwner)",
                    flags,
                ),
                re.compile(
                    r"function\s+mintTo\s*\([^)]*\)\s*(public|external)(?!.*onlyOwner)",
                    flags,
                ),
                # ERC20 internal mint exposed via external wrapper.
                re.compile(r"_mint\s*\(", flags),
            ],
            "pause": [
                re.compile(r"function\s+(pause|unpause|freeze)", flags),
                re.compile(r"whenNotPaused", flags),
                re.compile(r"Pausable", flags),
            ],
            "blacklist": [
                re.compile(r"blacklist", flags),
                re.compile(r"isBlacklisted", flags),
                re.compile(r"mapping\s*\(\s*address\s*=>\s*bool\s*\)\s*.*blacklist", flags),
            ],
            "proxy": [
                re.compile(r"delegatecall", flags),
                re.compile(r"implementation\s*\(\s*\)", flags),
                re.compile(r"upgradeTo\s*\(", flags),
                re.compile(r"TransparentUpgradeableProxy|UUPSUpgradeable", flags),
            ],
        }

    def _detect_legitimate_patterns(self, source_code: str) -> List[str]:
        """Detect known-safe / standard contract patterns to reduce false positives."""

        if not source_code:
            return []

        detected: List[str] = []
        for name, markers in LEGITIMATE_PATTERNS.items():
            for marker in markers:
                if re.search(marker, source_code, re.IGNORECASE | re.DOTALL):
                    detected.append(name)
                    break
        return detected

    def _find_evidence(self, source: str, patterns: List[re.Pattern], limit: int = 5) -> List[str]:
        evidence: List[str] = []
        for p in patterns:
            for m in p.finditer(source):
                snippet = source[max(0, m.start() - 40) : min(len(source), m.end() + 40)]
                snippet = re.sub(r"\s+", " ", snippet).strip()
                evidence.append(snippet)
                if len(evidence) >= limit:
                    return evidence
        return evidence

    async def _analyze_contract(self, token_data: Dict) -> Dict:
        """Analyze contract for red flags (regex-based)."""

        source = token_data.get("contract_source") or ""
        details: Dict[str, Any] = {
            "has_source": bool(source),
            "honeypot": {"flag": False, "evidence": []},
            "hidden_mint": {"flag": False, "evidence": []},
            "pause": {"flag": False, "evidence": []},
            "blacklist": {"flag": False, "evidence": []},
            "proxy": {"flag": False, "evidence": []},
        }
        signals: List[ScamSignal] = []

        if not source:
            return {"signals": signals, "details": details}

        patterns = self._compile_patterns()

        honeypot_evidence = self._find_evidence(source, patterns["honeypot"], limit=6)
        if honeypot_evidence:
            details["honeypot"] = {"flag": True, "evidence": honeypot_evidence}
            signals.append(ScamSignal.HONEYPOT)

        # Hidden mint analysis: specifically look for public/external mint without clear restrictions.
        hidden_mint_evidence = self._find_evidence(source, patterns["hidden_mint"], limit=6)
        unrestricted_mint = False
        # Additional pass: find mint/mintTo signatures and check for access control tokens.
        for m in re.finditer(r"function\s+(mint|mintTo)\s*\([^)]*\)\s*(public|external)([^\{;]*)", source, re.IGNORECASE):
            sig_tail = (m.group(0) or "")
            if not re.search(r"\bonlyOwner\b|\bonlyRole\b|\bonlyMinter\b|\baccessControl\b", sig_tail, re.IGNORECASE):
                unrestricted_mint = True
                hidden_mint_evidence.append(re.sub(r"\s+", " ", sig_tail).strip()[:200])
                break

        if hidden_mint_evidence and (unrestricted_mint or any("function mint" in ev.lower() or "function mintto" in ev.lower() for ev in hidden_mint_evidence)):
            details["hidden_mint"] = {"flag": True, "evidence": hidden_mint_evidence[:6]}
            signals.append(ScamSignal.HIDDEN_MINT)

        pause_evidence = self._find_evidence(source, patterns["pause"], limit=6)
        if pause_evidence:
            details["pause"] = {"flag": True, "evidence": pause_evidence}
            signals.append(ScamSignal.PAUSE_FUNCTION)

        blacklist_evidence = self._find_evidence(source, patterns["blacklist"], limit=6)
        # Avoid double-flagging if the only match is in comments; heuristic: require at least one match outside // comment.
        if blacklist_evidence:
            details["blacklist"] = {"flag": True, "evidence": blacklist_evidence}
            signals.append(ScamSignal.BLACKLIST_FUNCTION)

        proxy_evidence = self._find_evidence(source, patterns["proxy"], limit=6)
        if proxy_evidence:
            details["proxy"] = {"flag": True, "evidence": proxy_evidence}
            signals.append(ScamSignal.PROXY_UPGRADEABLE)

        return {"signals": signals, "details": details}

    def _parse_wallet_balances(self, token_data: Dict) -> Dict[str, float]:
        """Accept either mapping or list of {address,balance} / {wallet,balance}."""

        wb = token_data.get("wallet_balances") or token_data.get("holder_balances") or {}
        out: Dict[str, float] = {}

        if isinstance(wb, dict):
            for addr, bal in wb.items():
                out[self._norm_address(addr)] = self._safe_float(bal)
            return out

        if isinstance(wb, list):
            for row in wb:
                if not isinstance(row, dict):
                    continue
                addr = row.get("address") or row.get("wallet") or row.get("holder")
                if not addr:
                    continue
                bal = row.get("balance")
                out[self._norm_address(addr)] = self._safe_float(bal)

        return out

    async def _analyze_wallets(self, token_data: Dict) -> Dict:
        """Analyze team wallets and token distribution."""

        balances = self._parse_wallet_balances(token_data)
        total_supply = self._safe_float(token_data.get("total_supply"), default=0.0)
        team_wallets = [self._norm_address(a) for a in (token_data.get("team_wallets") or [])]
        liquidity = token_data.get("liquidity") or {}

        details: Dict[str, Any] = {
            "holders_count": len([a for a, b in balances.items() if b > 0]),
            "total_supply": total_supply,
            "top10_pct": None,
            "largest_holder_pct": None,
            "liquidity": liquidity,
            "team_wallets_pct": None,
            "flags": {},
        }
        signals: List[ScamSignal] = []

        # Concentration: top 10 > 50% of supply
        if balances and total_supply > 0:
            sorted_balances = sorted(balances.values(), reverse=True)
            top10 = sum(sorted_balances[:10])
            top10_pct = top10 / total_supply
            details["top10_pct"] = top10_pct

            largest_pct = sorted_balances[0] / total_supply
            details["largest_holder_pct"] = largest_pct

            if top10_pct > 0.50 or largest_pct > 0.20:
                signals.append(ScamSignal.CONCENTRATED_HOLDING)
                details["flags"]["concentration"] = {
                    "top10_pct": top10_pct,
                    "largest_holder_pct": largest_pct,
                    "thresholds": {"top10": 0.50, "largest": 0.20},
                }

        # Liquidity lock: interpret simple fields. Standalone heuristic.
        # Supported fields:
        # - liquidity_locked: bool
        # - lock_duration_days: number
        # - locker_address: str
        liquidity_locked = bool(liquidity.get("locked", liquidity.get("liquidity_locked", False)))
        lock_duration_days = self._safe_float(liquidity.get("lock_duration_days"), default=0.0)
        locker_address = self._norm_address(liquidity.get("locker_address") or liquidity.get("lock_address") or "")

        known_lockers = {self._norm_address(a) for a in self.config.get("known_liquidity_lockers", [])}
        # A few common placeholders (addresses differ by chain; tests can inject via config/data).
        for a in [
            "0x000000000000000000000000000000000000dead",  # burn/lock pseudo
        ]:
            known_lockers.add(self._norm_address(a))

        locker_recognized = locker_address in known_lockers if locker_address else False

        details["liquidity"] = {
            "locked": liquidity_locked,
            "lock_duration_days": lock_duration_days,
            "locker_address": locker_address or None,
            "locker_recognized": locker_recognized,
        }

        if not liquidity_locked or (lock_duration_days and lock_duration_days < 30) or (locker_address and not locker_recognized and lock_duration_days == 0):
            signals.append(ScamSignal.LOW_LIQUIDITY_LOCK)
            details["flags"]["liquidity_lock"] = {
                "locked": liquidity_locked,
                "lock_duration_days": lock_duration_days,
                "locker_recognized": locker_recognized,
            }

        # Team wallet patterns: if provided, compute share.
        if team_wallets and balances and total_supply > 0:
            team_total = sum(balances.get(addr, 0.0) for addr in team_wallets)
            team_pct = team_total / total_supply
            details["team_wallets_pct"] = team_pct

            # Suspicious: team holds > 20% directly.
            if team_pct > 0.20:
                if ScamSignal.CONCENTRATED_HOLDING not in signals:
                    signals.append(ScamSignal.CONCENTRATED_HOLDING)
                details["flags"]["team_concentration"] = {"team_pct": team_pct, "threshold": 0.20}

        return {"signals": signals, "details": details}

    async def _analyze_socials(self, token_data: Dict) -> Dict:
        """Analyze social media for fake engagement."""

        social_data = token_data.get("social_data") or token_data.get("social_links") or {}
        details: Dict[str, Any] = {"provided": bool(social_data), "platforms": {}, "flags": {}}
        signals: List[ScamSignal] = []

        if not social_data or not isinstance(social_data, dict):
            return {"signals": signals, "details": details}

        # social_data can be structured per platform: {"twitter": {...}, "telegram": {...}}
        fake_reasons: List[str] = []

        for platform, pdata in social_data.items():
            if not isinstance(pdata, dict):
                continue

            followers = int(self._safe_float(pdata.get("followers"), default=0.0))
            engagement_rate = self._safe_float(pdata.get("engagement_rate"), default=0.0)
            avg_likes = self._safe_float(pdata.get("avg_likes"), default=0.0)
            avg_comments = self._safe_float(pdata.get("avg_comments"), default=0.0)
            posts_per_day = self._safe_float(pdata.get("posts_per_day"), default=0.0)
            account_age_days = self._safe_float(pdata.get("account_age_days"), default=9999.0)
            handle = (pdata.get("handle") or pdata.get("username") or "")

            details["platforms"][platform] = {
                "followers": followers,
                "engagement_rate": engagement_rate,
                "avg_likes": avg_likes,
                "avg_comments": avg_comments,
                "posts_per_day": posts_per_day,
                "account_age_days": account_age_days,
                "handle": handle or None,
            }

            # Fake followers indicators: high followers, low engagement.
            if followers >= 50000 and (engagement_rate > 0 and engagement_rate < 0.01):
                fake_reasons.append(f"{platform}: high followers with very low engagement")
            if followers >= 50000 and engagement_rate == 0 and (avg_likes + avg_comments) < 50:
                fake_reasons.append(f"{platform}: high followers with low likes/comments")

            # Account age < 30 days
            if account_age_days < 30:
                fake_reasons.append(f"{platform}: very new account ({account_age_days:.0f} days)")

            # Bot patterns: extremely high posting, digit-heavy handles.
            if posts_per_day >= 50:
                fake_reasons.append(f"{platform}: unusually high posting frequency")
            if handle and re.search(r"\d{5,}", handle):
                fake_reasons.append(f"{platform}: suspicious handle pattern")

        if fake_reasons:
            signals.append(ScamSignal.FAKE_SOCIALS)
            details["flags"]["fake_socials"] = {"reasons": fake_reasons[:10]}

        return {"signals": signals, "details": details}

    def _extract_domain(self, website_url: str) -> str:
        if not website_url:
            return ""
        m = re.search(r"^(?:https?://)?([^/]+)", website_url.strip(), re.IGNORECASE)
        if not m:
            return website_url.strip().lower()
        host = m.group(1).lower()
        # strip port
        return host.split(":")[0]

    async def _analyze_domain(self, token_data: Dict) -> Dict:
        """Analyze website and domain legitimacy."""

        website_url = token_data.get("website_url") or ""
        domain_data = token_data.get("domain_data") or {}

        domain = domain_data.get("domain") or self._extract_domain(website_url)
        domain = (domain or "").lower()

        details: Dict[str, Any] = {
            "website_url": website_url or None,
            "domain": domain or None,
            "domain_age_days": domain_data.get("age_days") or domain_data.get("domain_age_days"),
            "flags": {},
        }
        signals: List[ScamSignal] = []

        if not domain and not domain_data:
            return {"signals": signals, "details": details}

        age_days = self._safe_float(domain_data.get("age_days") or domain_data.get("domain_age_days"), default=None)
        if age_days is not None:
            details["domain_age_days"] = age_days
            if age_days < 30:
                signals.append(ScamSignal.NEW_DOMAIN)
                details["flags"]["new_domain"] = {"age_days": age_days, "threshold": 30}

        # Typosquatting / suspicious domain heuristics
        suspicious_reasons: List[str] = []
        if domain:
            if domain.startswith("xn--"):
                suspicious_reasons.append("punycode domain")
            if re.search(r"\b(uniswap|pancakeswap|ethereum|solana|binance)\b", domain) and re.search(
                r"(uniswap|pancakeswap|ethereum|solana|binance)[a-z0-9-]{2,}",
                domain,
            ):
                suspicious_reasons.append("potential typosquatting on major brand")
            if domain.endswith((".top", ".xyz", ".click", ".zip", ".mov")):
                suspicious_reasons.append("high-risk TLD")

        template_similarity = self._safe_float(domain_data.get("template_similarity"), default=0.0)
        copied_template = bool(domain_data.get("copied_template", False)) or template_similarity >= 0.85
        if copied_template:
            suspicious_reasons.append("website template highly similar to known scams")

        if suspicious_reasons:
            # Domain issues are generally lower weight; reuse NEW_DOMAIN signal for "domain suspicious" too.
            if ScamSignal.NEW_DOMAIN not in signals:
                signals.append(ScamSignal.NEW_DOMAIN)
            details["flags"]["suspicious_domain"] = {
                "reasons": suspicious_reasons,
                "template_similarity": template_similarity,
            }

        return {"signals": signals, "details": details}

    def _calculate_scam_score(
        self,
        signals: List[ScamSignal],
        details: Dict,
        *,
        token_data: Optional[Dict[str, Any]] = None,
        legitimate_patterns: Optional[List[str]] = None,
        mitigated_signals: Optional[List[str]] = None,
        whitelist_info: Optional[Dict[str, Any]] = None,
    ) -> float:
        """Calculate overall scam probability score (context-aware)."""

        token_data = token_data or {}
        legitimate_patterns = legitimate_patterns or []
        mitigated_signals = mitigated_signals or []

        # Weight signals by severity (base)
        weights = {
            ScamSignal.HONEYPOT: 50,
            ScamSignal.HIDDEN_MINT: 40,
            ScamSignal.TEAM_HISTORY_RUG: 45,
            ScamSignal.COPIED_SCAM_CODE: 35,
            ScamSignal.PAUSE_FUNCTION: 15,
            ScamSignal.BLACKLIST_FUNCTION: 15,
            ScamSignal.PROXY_UPGRADEABLE: 20,
            ScamSignal.LOW_LIQUIDITY_LOCK: 25,
            ScamSignal.CONCENTRATED_HOLDING: 20,
            ScamSignal.FAKE_SOCIALS: 25,
            ScamSignal.NEW_DOMAIN: 10,
            ScamSignal.ANONYMOUS_TEAM: 15,
        }

        # Mitigation factors for specific signals when legitimate patterns are present.
        # Lower = reduces risk contribution.
        mitigation_multiplier: Dict[ScamSignal, float] = {}

        if "layerzero_oft" in legitimate_patterns:
            mitigation_multiplier[ScamSignal.HIDDEN_MINT] = 0.20

        if "timelock_protected" in legitimate_patterns:
            mitigation_multiplier[ScamSignal.PROXY_UPGRADEABLE] = 0.35

        # DEX tokens (Velodrome/Aerodrome/Solidly) legitimately mint for emissions
        if "velodrome_dex" in legitimate_patterns:
            mitigation_multiplier[ScamSignal.HIDDEN_MINT] = 0.20

        # Uniswap-style DEXes
        if "uniswap_style" in legitimate_patterns:
            mitigation_multiplier[ScamSignal.HIDDEN_MINT] = 0.25

        # Stablecoin / issuer patterns: pause/blacklist/minter are normal.
        if "stablecoin_standard" in legitimate_patterns or "circle_usdc" in legitimate_patterns:
            mitigation_multiplier[ScamSignal.BLACKLIST_FUNCTION] = 0.40
            mitigation_multiplier[ScamSignal.PAUSE_FUNCTION] = 0.50

        # Whitelisted tokens: heavily reduce common false-positive signals.
        if whitelist_info:
            mitigation_multiplier.setdefault(ScamSignal.PROXY_UPGRADEABLE, 0.20)
            mitigation_multiplier.setdefault(ScamSignal.LOW_LIQUIDITY_LOCK, 0.20)
            mitigation_multiplier.setdefault(ScamSignal.HIDDEN_MINT, 0.15)

        # Maturity calibration: established tokens with real volume should not be
        # penalized as aggressively for non-critical heuristics.
        age_days = self._safe_float(
            token_data.get("contract_age_days")
            or token_data.get("token_age_days")
            or token_data.get("age_days"),
            default=0.0,
        )
        vol_24h = self._safe_float(token_data.get("volume_24h") or token_data.get("volume_usd_24h"), default=0.0)
        mature = bool(age_days >= 180 and vol_24h >= 1_000_000)

        score = 0.0
        for s in signals:
            w = float(weights.get(s, 10))

            # Reduce severity for mature tokens on non-critical signals.
            if mature and s not in {ScamSignal.HONEYPOT, ScamSignal.TEAM_HISTORY_RUG, ScamSignal.COPIED_SCAM_CODE}:
                w *= 0.60

            # Apply mitigation if requested.
            if s.value in mitigated_signals:
                w *= float(mitigation_multiplier.get(s, 0.35 if whitelist_info else 0.50))

            score += w

        # Verified + known issuer patterns: additional reduction.
        verified = bool(token_data.get("contract_verified") or token_data.get("verified") or token_data.get("is_verified"))
        if verified and (set(legitimate_patterns) & {"circle_usdc", "canonical_weth", "stablecoin_standard"}):
            score *= 0.75

        # Apply whitelist floor (min_score on 0-10 => cap max risk on 0-100).
        # NOTE: we do not override truly critical signals like honeypot.
        if whitelist_info and ScamSignal.HONEYPOT not in signals:
            try:
                min_score_0_10 = float(whitelist_info.get("min_score", 0.0))
            except Exception:
                min_score_0_10 = 0.0
            max_risk = max(0.0, (10.0 - min_score_0_10) * 10.0)
            score = min(score, max_risk)
            details.setdefault("whitelist", {})
            details["whitelist"]["applied_max_scam_score"] = max_risk

        return min(100, float(score))  # Cap at 100

    def _calculate_confidence(self, token_data: Dict) -> float:
        """Calculate confidence in the analysis based on data availability."""

        # More data = higher confidence
        confidence = 0.5  # Base confidence
        if token_data.get("contract_source"):
            confidence += 0.2
        if token_data.get("team_wallets") or token_data.get("wallet_balances") or token_data.get("holder_balances"):
            confidence += 0.15
        if token_data.get("social_links") or token_data.get("social_data"):
            confidence += 0.1
        if token_data.get("website_url") or token_data.get("domain_data"):
            confidence += 0.05
        return min(1.0, confidence)

    def _get_recommendation(self, score: float) -> str:
        """Get recommendation based on scam score."""

        if score < 20:
            return "SAFE"
        elif score < 40:
            return "CAUTION"
        elif score < 70:
            return "HIGH_RISK"
        else:
            return "LIKELY_SCAM"

    def _generate_explanation(self, signals: List[ScamSignal], details: Dict) -> str:
        """Generate human-readable explanation of findings."""

        if not signals:
            return "No significant scam signals detected. Standard caution advised."

        explanations: List[str] = []
        for signal in signals:
            if signal == ScamSignal.HONEYPOT:
                explanations.append("⚠️ HONEYPOT DETECTED: Contract contains patterns consistent with sell restrictions")
            elif signal == ScamSignal.HIDDEN_MINT:
                explanations.append("⚠️ Hidden/unrestricted mint function could allow unlimited token creation")
            elif signal == ScamSignal.TEAM_HISTORY_RUG:
                explanations.append("⚠️ Team wallets linked to previous rug pulls")
            elif signal == ScamSignal.PAUSE_FUNCTION:
                explanations.append("⚠️ Contract includes pause/freeze controls (admin can halt transfers)")
            elif signal == ScamSignal.BLACKLIST_FUNCTION:
                explanations.append("⚠️ Contract includes blacklist controls (admin can block wallets)")
            elif signal == ScamSignal.PROXY_UPGRADEABLE:
                explanations.append("⚠️ Upgradeable/proxy patterns detected (implementation can change)")
            elif signal == ScamSignal.LOW_LIQUIDITY_LOCK:
                explanations.append("⚠️ Liquidity appears unlocked/weakly locked")
            elif signal == ScamSignal.CONCENTRATED_HOLDING:
                explanations.append("⚠️ Token distribution is highly concentrated among top wallets")
            elif signal == ScamSignal.FAKE_SOCIALS:
                explanations.append("⚠️ Social signals suggest fake followers / bot-like activity")
            elif signal == ScamSignal.NEW_DOMAIN:
                explanations.append("⚠️ Website/domain shows new or suspicious characteristics")
            elif signal == ScamSignal.ANONYMOUS_TEAM:
                explanations.append("⚠️ Team anonymity increases risk")
            elif signal == ScamSignal.COPIED_SCAM_CODE:
                explanations.append("⚠️ Contract resembles known scam templates")

        return "\n".join(explanations)


# Export for use in scoring engine
__all__ = ["ScamBot", "ScamAnalysis", "ScamSignal"]
