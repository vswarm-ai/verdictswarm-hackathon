"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { InterrogationRoom } from "@/components/scan/InterrogationRoom";
import Card from "@/components/ui/Card";

import type { ScanResult, CategoryBreakdown, DebateOutcome, DebateRecord, DebateRound, Finding } from "@/types/scan-events";

/* ─── Grade Helpers ─── */

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "A-";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function gradeColor(score: number): string {
  if (score >= 70) return "#00D4AA";
  if (score >= 50) return "#FFD700";
  return "#FF0055";
}

function severityBadge(severity: string): { color: string; bg: string; label: string } {
  switch (severity) {
    case "critical":
      return { color: "text-[#FF0055]", bg: "bg-[#FF0055]/10 border-[#FF0055]/30", label: "CRITICAL" };
    case "warning":
      return { color: "text-[#FFD700]", bg: "bg-[#FFD700]/10 border-[#FFD700]/30", label: "WARNING" };
    case "positive":
      return { color: "text-[#00D4AA]", bg: "bg-[#00D4AA]/10 border-[#00D4AA]/30", label: "POSITIVE" };
    default:
      return { color: "text-[#00D4FF]", bg: "bg-[#00D4FF]/10 border-[#00D4FF]/30", label: "INFO" };
  }
}

/* ─── Category Icons ─── */

const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  security: { icon: "🔒", label: "Security", color: "#00D4FF" },
  liquidity: { icon: "💧", label: "Liquidity", color: "#00D4AA" },
  social: { icon: "👥", label: "Social", color: "#6B46C1" },
  utility: { icon: "💡", label: "Utility", color: "#FFD700" },
  Technical: { icon: "📊", label: "Technical", color: "#00D4FF" },
  Safety: { icon: "🔒", label: "Safety", color: "#FF6B6B" },
  Tokenomics: { icon: "💰", label: "Tokenomics", color: "#FFD700" },
  Social: { icon: "🐦", label: "Social", color: "#6B46C1" },
  Macro: { icon: "🌍", label: "Macro", color: "#00D4AA" },
  Contrarian: { icon: "😈", label: "Devil's Advocate", color: "#FF0055" },
};

/* ─── Results View Component ─── */

function ResultsView({ result, currentTier = "FREE" }: { result: ScanResult; currentTier?: string }) {
  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const color = gradeColor(result.score);
  const grade = result.grade || scoreToGrade(result.score);

  const categories = Object.entries(result.breakdown || {}).map(
    ([key, val]: [string, CategoryBreakdown]) => ({
      key,
      ...(CATEGORY_META[key] || { icon: "📊", label: key, color: "#6B46C1" }),
      ...val,
    }),
  );

  // Flatten all findings for the evidence locker
  const allFindings: Array<Finding & { category: string }> = [];
  for (const [cat, val] of Object.entries(result.breakdown || {})) {
    for (const f of (val as CategoryBreakdown).findings || []) {
      allFindings.push({ ...f, category: cat });
    }
  }

  // Token metadata from fullResults
  const token = (result.fullResults as Record<string, unknown>)?.token as
    | { name?: string; symbol?: string; price_usd?: number; mcap?: number; volume_24h?: number; liquidity_usd?: number; contract_age_days?: number; contract_verified?: boolean }
    | undefined;

  const formatUsd = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(2)}`;

  const buildCardPayload = () => ({
    tokenName: token?.name || "Unknown Token",
    tokenSymbol: token?.symbol || "",
    verdict: grade,
    score: result.score,
    findings: allFindings.slice(0, 5).map((f) => f.message),
    reportUrl: typeof window !== "undefined" ? window.location.href : "",
    summary: ((result.fullResults as Record<string, unknown>)?.summary as string) || "",
    agentCount: result.agentCount || 0,
    durationSec: (result.durationMs || 0) / 1000,
    agents: categories.filter(c => c.score > 0).map(c => ({
      label: c.label,
      score: c.score, // already 0-10 scale from backend
      icon: c.icon,
    })),
    mcap: token?.mcap ? formatUsd(token.mcap) : "",
    liquidity: token?.liquidity_usd ? formatUsd(token.liquidity_usd) : "",
    age: token?.contract_age_days ? `${token.contract_age_days}d old` : "",
    chain: ((result.fullResults as Record<string, unknown>)?.chain as string) || "",
  });

  const address = ((result.fullResults as Record<string, unknown>)?.address as string) || "";
  const rawChain = (((result.fullResults as Record<string, unknown>)?.chain as string) || "").toLowerCase();
  // Detect Solana addresses by format: base58 (no 0x prefix, 32-44 chars)
  const chain = rawChain && rawChain !== "blockchain" ? rawChain : (
    address && !address.startsWith("0x") && address.length >= 32 && address.length <= 44 ? "solana" : rawChain || "base"
  );
  const tokenSnifferChain = chain === "solana" ? "sol" : "eth";

  const researchLinks: Array<{ label: string; url: string; icon: string }> = [];

  if (address) {
    if (chain === "ethereum") {
      researchLinks.push(
        { label: "Etherscan", url: `https://etherscan.io/token/${address}`, icon: "🔍" },
        { label: "DexScreener", url: `https://dexscreener.com/ethereum/${address}`, icon: "📊" },
        { label: "DEXTools", url: `https://www.dextools.io/app/en/ether/pair-explorer/${address}`, icon: "📈" },
      );

      if (token?.name) {
        researchLinks.push({
          label: "CoinGecko",
          url: `https://www.coingecko.com/en/coins/${token.name.toLowerCase()}`,
          icon: "🦎",
        });
      }
    }

    if (chain === "base") {
      researchLinks.push(
        { label: "BaseScan", url: `https://basescan.org/token/${address}`, icon: "🔍" },
        { label: "DexScreener", url: `https://dexscreener.com/base/${address}`, icon: "📊" },
      );
    }

    if (chain === "solana") {
      researchLinks.push(
        { label: "Solscan", url: `https://solscan.io/token/${address}`, icon: "🔍" },
        { label: "DexScreener", url: `https://dexscreener.com/solana/${address}`, icon: "📊" },
        { label: "Birdeye", url: `https://birdeye.so/token/${address}?chain=solana`, icon: "👁️" },
        { label: "GMGN", url: `https://gmgn.ai/sol/token/${address}`, icon: "🧭" },
      );
    }

    researchLinks.push({
      label: "TokenSniffer",
      url: `https://tokensniffer.com/token/${tokenSnifferChain}/${address}`,
      icon: "🔒",
    });
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Token Header */}
      {token?.name && (
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-orbitron text-2xl font-bold text-white md:text-3xl">
              {token.name} <span className="text-white/40">({token.symbol})</span>
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40 font-mono">
              {(token.mcap ?? 0) > 0 && <span>MCap {formatUsd(token.mcap!)}</span>}
              {(token.liquidity_usd ?? 0) > 0 && <span>Liq {formatUsd(token.liquidity_usd!)}</span>}
              {(token.volume_24h ?? 0) > 0 && <span>Vol 24h {formatUsd(token.volume_24h!)}</span>}
              {(token.contract_age_days ?? 0) > 0 && <span>{token.contract_age_days}d old</span>}
              {token.contract_verified && <span className="text-[#00D4AA]">✓ Verified</span>}
            </div>
          </div>
        </div>
      )}

      {/* Header / Verdict */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h1
            className="font-orbitron text-3xl font-bold uppercase md:text-4xl"
            style={{ color }}
          >
            Verdict
          </h1>
          <p className="mt-2 text-sm text-white/50 font-mono">
            {result.agentCount} agents • {(result.durationMs || 0) > 0 ? `${((result.durationMs || 0) / 1000).toFixed(1)}s` : "cached ⚡"}
            {result.onchainTx && " • On-Chain ✓"}
          </p>
          {result.onchainTx && (
            <a
              href={result.onchainTx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 rounded-lg border border-[#9945FF]/30 bg-[#9945FF]/10 px-3 py-1.5 text-xs font-medium text-[#9945FF] transition hover:bg-[#9945FF]/20"
            >
              <span>◎</span> Verified On-Chain
              <span className="text-[#9945FF]/50 ml-1 font-mono text-[10px]">
                {result.onchainTx.txSignature.slice(0, 8)}...
              </span>
            </a>
          )}
          {/* Change 4: Share buttons near score section */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => {
                const name = token?.name || "Token";
                const sym = token?.symbol ? ` ($${token.symbol})` : "";
                const tweetText = [
                  `🐝 ${name}${sym} scored ${result.score}/100 (Grade ${grade}) on VerdictSwarm`,
                  "",
                  `Free AI-powered token analysis → ${window.location.href}`,
                  "",
                  "@VswarmAi",
                ].join("\n");
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
                window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00D4AA]/20 bg-[#00D4AA]/5 px-3 py-1.5 text-xs font-medium text-[#00D4AA] transition hover:bg-[#00D4AA]/15"
            >
              ↗ Share on 𝕏
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/verdict-card", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(buildCardPayload()),
                  });
                  if (!res.ok) throw new Error("Failed to generate card");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `verdictswarm-${token?.symbol || "scan"}.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  void navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#6B46C1]/20 bg-[#6B46C1]/5 px-3 py-1.5 text-xs font-medium text-[#6B46C1] transition hover:bg-[#6B46C1]/15"
            >
              🖼 Download Card
            </button>
            <button
              onClick={() => {
                // Force rescan — reload with fresh=true
                const url = new URL(window.location.href);
                url.searchParams.set("fresh", "true");
                window.location.href = url.toString();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-500/20 bg-gray-500/5 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-500/15"
            >
              🔄 Rescan
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Score */}
          <div className="text-right">
            <div
              className="font-orbitron text-5xl font-bold md:text-6xl"
              style={{ color }}
            >
              {Math.round(result.score)}/100
            </div>
          </div>
          {/* Grade Badge */}
          <div className="relative">
            <div
              className="font-orbitron text-7xl font-black md:text-8xl"
              style={{
                color,
                textShadow: `0 0 40px ${color}40`,
              }}
            >
              {grade}
            </div>
            {result.score >= 70 && (
              <div
                className="absolute -right-4 top-0 -rotate-12 rounded-lg border-2 px-3 py-1 text-xs font-bold uppercase"
                style={{
                  borderColor: `${color}60`,
                  color,
                  background: `${color}15`,
                }}
              >
                Approved
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change 1: Verdict Summary */}
      {((result.fullResults as Record<string, unknown>)?.summary as string) && (
        <Card className="border-[#00D4AA]/20 bg-gradient-to-r from-[#00D4AA]/5 to-[#6B46C1]/5 p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🐝</span>
            <div>
              <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#00D4AA] mb-3">
                The Swarm Has Spoken
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {(result.fullResults as Record<string, unknown>)?.summary as string}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Scout Scan Banner */}
      {(result.agentCount || 0) <= 2 && (
        <Card className="relative overflow-hidden border-[#FFD700]/30 bg-gradient-to-r from-[#FFD700]/5 to-[#FF8C00]/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <div className="text-sm font-bold text-[#FFD700]">Scout Scan — {result.agentCount} of 5 Swarm Agents</div>
                <p className="text-xs text-white/50 mt-0.5">
                  Free scans deploy a mini-swarm with <strong className="text-white/70">limited accuracy</strong>. Scores may vary ±10% between runs. The full VerdictSwarm deploys 6 AI agents + Devil&apos;s Advocate across multiple models that <strong className="text-white/70">debate and cross-check</strong> each other — significantly improving consistency and accuracy.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-white/40 font-mono">Confidence</div>
              <div className="font-orbitron text-lg font-bold text-[#FFD700]">Limited</div>
            </div>
          </div>
        </Card>
      )}

      {/* Breakdown Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => {
          const aiModel: Record<string, string> = {
            Technical: "GPT-4o Mini (OpenAI)",
            Safety: "Claude 3 Haiku (Anthropic)",
            Tokenomics: "Gemini 2.5 Flash (Google)",
            Social: "Grok 3 (xAI)",
            Macro: "Grok (xAI)",
            Contrarian: "Gemini 2.5 Flash (Google)",
          };
          return (
            <Card
              key={cat.key}
              className="group relative overflow-hidden p-6 transition-all hover:border-[#6B46C1]/40"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white/80">{cat.label}</div>
                  <div
                    className="font-orbitron text-2xl font-bold"
                    style={{ color: gradeColor(Math.round(cat.score) * 10) }}
                  >
                    {cat.score.toFixed(0)}/10
                  </div>
                </div>
              </div>
              {aiModel[cat.label] && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00D4AA]" />
                  Powered by {aiModel[cat.label]}
                </div>
              )}
              {cat.summary && (
                <p className="mt-2 text-xs text-white/50 leading-relaxed">
                  {cat.summary}
                </p>
              )}
              {/* Score bar */}
              <div className="mt-3 h-1 w-full rounded-full bg-[#2D2D3A]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(cat.score / 10) * 100}%`,
                    background: gradeColor(Math.round(cat.score) * 10),
                  }}
                />
              </div>
            </Card>
          );
        })}

        {/* Locked Agent Cards — only show agents not already in breakdown */}
        {[
          { icon: "💰", label: "Tokenomics", key: "Tokenomics", desc: "Supply, distribution & inflation analysis", model: "Gemini 2.5 Pro", tier: "Tier 1" },
          { icon: "🐦", label: "Social", key: "Social", desc: "Real-time community sentiment via X/social", model: "Grok 4 (xAI)", tier: "Tier 1" },
          { icon: "🌍", label: "Macro", key: "Macro", desc: "Market conditions & sector analysis", model: "Grok (xAI)", tier: "Tier 1" },
        ].filter((locked) => !categories.some(c => c.label === locked.label)).map((locked) => (
          <Card
            key={locked.label}
            className="group relative overflow-hidden p-6 opacity-50 border-dashed border-[#2D2D3A]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl grayscale">{locked.icon}</span>
              <div>
                <div className="text-sm font-bold text-white/40">{locked.label}</div>
                <div className="font-orbitron text-2xl font-bold text-white/20">
                  —/10
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/30">{locked.desc}</p>
            <div className="mt-1 text-[10px] text-white/20 font-mono">
              🧠 {locked.model}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-[#6B46C1]">
              <span>🔒</span> {locked.tier}
            </div>
          </Card>
        ))}
      </div>

      {/* "Why This Score?" Section */}
      {categories.length > 0 && (
        <Card className="p-6">
          <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-white/60 mb-4">
            Why {Math.round(result.score)}/100?
          </h3>
          <div className="space-y-2 text-sm text-white/70">
            {categories.map(cat => {
              // Try category summary, fallback to fullResults.analysis
              const analysisFallback = ((result.fullResults as Record<string, unknown>)?.analysis as Record<string, { summary?: string }>) || {};
              const analysisKeyMap: Record<string, string> = { Technical: "technical", Safety: "security", Tokenomics: "tokenomics", Social: "social", Macro: "macro", Contrarian: "devils_advocate" };
              const summaryText = cat.summary || analysisFallback[analysisKeyMap[cat.label] || cat.key]?.summary || "";
              // Split on ". " (period+space) to avoid breaking on "Gemini 2.5" etc.
              const sentenceMatch = summaryText.match(/^(.+?\.\s)/);
              const firstSentence = sentenceMatch ? sentenceMatch[1].trim() : (summaryText.length > 120 ? summaryText.slice(0, 120).trim() + '…' : summaryText);
              return (
                <div key={cat.key} className="flex items-start gap-3">
                  <span className="shrink-0">{cat.icon}</span>
                  <span className="shrink-0 font-medium text-white/80">{cat.label}:</span>
                  <span className="shrink-0">{cat.score.toFixed(0)}/10</span>
                  {firstSentence && (
                    <>
                      <span className="text-white/40 shrink-0">—</span>
                      <span className="text-white/50 line-clamp-2">{firstSentence}</span>
                    </>
                  )}
                </div>
              );
            })}
            {result.agentCount <= 2 && (
              <p className="text-xs text-[#FFD700]/70 mt-2 italic">
                Score based on {result.agentCount} of 20 agents — scores may vary ±10% between runs at this tier. More agents + model diversity = higher accuracy and consistency.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Agent Agreement Map */}
      {categories.filter(c => c.score > 0).length >= 3 && (
        <Card className="p-6">
          <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-white/60 mb-4">
            Agent Agreement Map
          </h3>
          <div className="flex flex-wrap gap-3">
            {categories.filter(c => c.score > 0).map(cat => {
              const activeCats = categories.filter(c => c.score > 0);
              const avgScore = activeCats.reduce((s, c) => s + c.score, 0) / activeCats.length;
              const diff = Math.abs(cat.score - avgScore);
              const isAgreeing = diff < 1.0;
              const isDissenting = diff >= 1.5;
              return (
                <div
                  key={cat.key}
                  className={`rounded-lg border px-4 py-3 text-center ${
                    isDissenting
                      ? 'border-[#FF0055]/30 bg-[#FF0055]/5'
                      : isAgreeing
                        ? 'border-[#00D4AA]/30 bg-[#00D4AA]/5'
                        : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <div className="text-xs font-medium mt-1">{cat.label}</div>
                  <div className="font-orbitron text-sm font-bold" style={{ color: gradeColor((cat.score / 10) * 100) }}>
                    {cat.score.toFixed(1)}
                  </div>
                  <div className={`text-[10px] mt-1 ${isDissenting ? 'text-[#FF0055]' : isAgreeing ? 'text-[#00D4AA]' : 'text-white/30'}`}>
                    {isDissenting ? '⚔️ Dissent' : isAgreeing ? '✅ Agrees' : '— Neutral'}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* How the Swarm Reached Consensus */}
      {((result.fullResults as Record<string, unknown>)?.consensus_narrative as string) && (
        <Card className="border-[#6B46C1]/20 bg-gradient-to-r from-[#1A1A28] to-[#0A0B0F] p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">⚖️</span>
            <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#6B46C1]">
              How the Swarm Reached Consensus
            </h3>
          </div>
          <div className="space-y-3">
            {((result.fullResults as Record<string, unknown>)?.consensus_narrative as string)
              .split('\n')
              .filter(Boolean)
              .map((line, i) => (
                <p key={i} className={`text-sm leading-relaxed ${
                  line.startsWith('⚖️') ? 'text-[#FFD700]/80' :
                  line.startsWith('Most optimistic') ? 'text-[#00D4AA]/80' :
                  line.startsWith('Most critical') ? 'text-[#FF6B6B]/80' :
                  'text-white/70'
                }`}>
                  {line}
                </p>
              ))}
          </div>
        </Card>
      )}

      {/* Swarm Intelligence Explainer */}
      {(result.agentCount || 0) <= 2 && (
        <Card className="border-[#6B46C1]/20 bg-[#6B46C1]/5 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">🐝</span>
            <div>
              <div className="text-sm font-bold text-[#6B46C1]">Unlock the Full Swarm</div>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                This Scout Scan used <strong className="text-white/70">2 agents</strong> powered by <strong className="text-white/70">Gemini 2.5 Flash</strong>.
                The full VerdictSwarm upgrades to <strong className="text-white/70">6 agents + DA</strong> running on <strong className="text-white/70">multiple AI models</strong> —
                including <strong className="text-white/70">Gemini 2.5 Pro</strong>, <strong className="text-white/70">Grok 4 (real-time X data)</strong>, and
                a <strong className="text-white/70">Devil&apos;s Advocate</strong> agent that challenges every finding.
              </p>
              <p className="text-xs text-white/50 mt-2 leading-relaxed">
                When swarm agents disagree, they <strong className="text-white/70">debate in real-time</strong> until
                reaching consensus — the same principle that makes bee swarms and prediction markets
                smarter than any individual. More models × more perspectives = <strong className="text-white/70">higher accuracy</strong>.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#0A0B0F] p-2">
                  <div className="font-orbitron text-sm font-bold text-[#00D4AA]">2 → 7</div>
                  <div className="text-[10px] text-white/30">Agents</div>
                </div>
                <div className="rounded-lg bg-[#0A0B0F] p-2">
                  <div className="font-orbitron text-sm font-bold text-[#6B46C1]">1 → 3+</div>
                  <div className="text-[10px] text-white/30">AI Models</div>
                </div>
                <div className="rounded-lg bg-[#0A0B0F] p-2">
                  <div className="font-orbitron text-sm font-bold text-[#FFD700]">+ Debates</div>
                  <div className="text-[10px] text-white/30">Consensus</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Agent Debates */}
      {result.debates && result.debates.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">⚔️</span>
            <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#FF0055]">
              Agent Debates
            </h3>
            <span className="text-xs text-white/30 ml-auto">{result.debates.length} debate{result.debates.length > 1 ? 's' : ''} triggered</span>
          </div>
          <div className="space-y-6">
            {result.debates.map((d: DebateRecord, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-[#FF0055]/20 bg-[#FF0055]/5 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-[#FF0055] uppercase">Debate #{i + 1}</span>
                  <span className="text-xs text-white/40">—</span>
                  <span className="text-sm font-medium text-white/80">{d.topic}</span>
                </div>

                {/* Debate Rounds (full transcript) */}
                {d.rounds && d.rounds.length > 0 ? (
                  <div className="space-y-3 mb-3">
                    {d.rounds.map((round: DebateRound, ri: number) => {
                      const phaseIcons: Record<string, string> = {
                        challenge: "⚔️",
                        defense: "🛡️",
                        rebuttal: "🔥",
                        resolution: "⚖️",
                        consensus: "🐝",
                      };
                      const phaseColors: Record<string, string> = {
                        challenge: "#FF0055",
                        defense: "#00D4AA",
                        rebuttal: "#FF6B6B",
                        resolution: "#FFD700",
                        consensus: "#00D4FF",
                      };
                      const icon = phaseIcons[round.phase] || "💬";
                      const color = phaseColors[round.phase] || "#888";
                      return (
                        <div key={ri} className="pl-3 border-l-2" style={{ borderColor: `${color}40` }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                              {round.phase}
                            </span>
                            <span className="text-xs text-white/60">
                              {round.agentName}
                              {round.targetName && (
                                <span className="text-white/30"> → {round.targetName}</span>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 leading-relaxed">{round.content}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/60 leading-relaxed mb-3">{d.resolution}</p>
                )}

                {/* Outcome badge */}
                {d.outcome === "split" && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-[#FFD700]/10 border border-[#FFD700]/30 px-2 py-0.5 text-xs font-bold text-[#FFD700]">
                      ⚠️ SPLIT VERDICT
                    </span>
                    <span className="text-xs text-white/30">Agents could not agree — both positions shown</span>
                  </div>
                )}
                {d.outcome === "compromise" && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-2 py-0.5 text-xs font-bold text-[#00D4AA]">
                      ✅ COMPROMISE
                    </span>
                    <span className="text-xs text-white/30">Score adjusted after debate</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Change 3: Evidence Locker - Improved */}
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#6B46C1]">
            Evidence Locker
          </h3>
        </div>

        <div className="mt-4 space-y-2">
          {(() => {
            // Sort findings: critical → warning → info → positive (most interesting first)
            const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
            const sortedFindings = [...allFindings].sort(
              (a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
            );

            // Show up to 5 findings
            const visibleCount = Math.min(5, sortedFindings.length);
            const hiddenCount = sortedFindings.length - visibleCount;

            return (
              <>
                {sortedFindings.slice(0, visibleCount).map((f, i) => {
                  const badge = severityBadge(f.severity);
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 ${badge.bg}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-white/40">
                          {CATEGORY_META[f.category]?.label || f.category}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/80">{f.message}</p>
                    </div>
                  );
                })}

                {/* Blurred teaser: show severity + category but blur message */}
                {hiddenCount > 0 && (
                  <>
                    <button
                      onClick={() => setShowUpgradeDetails((v) => !v)}
                      className="w-full text-left relative rounded-lg border border-[#2D2D3A] bg-[#1A1A28]/50 p-3 overflow-hidden cursor-pointer hover:border-[#6B46C1]/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-white/30">
                          {sortedFindings[visibleCount]?.severity?.toUpperCase() || "FINDING"}
                        </span>
                        <span className="text-xs text-white/20">
                          {CATEGORY_META[sortedFindings[visibleCount]?.category]?.label || "Analysis"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/80 blur-sm select-none">
                        {sortedFindings[visibleCount]?.message || "Additional analysis details available..."}
                      </p>
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A28]/30">
                        <span className="text-xs text-[#6B46C1] font-bold">
                          🔒 Unlock {hiddenCount} more findings — tap for details
                        </span>
                      </div>
                    </button>

                    {showUpgradeDetails && (
                      <div className="rounded-xl border border-[#6B46C1]/30 bg-[#1A1A28] p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="text-[#6B46C1]">⚡</span> What you&apos;re missing
                        </h4>

                        {/* Show locked finding categories breakdown */}
                        {(() => {
                          const locked = sortedFindings.slice(visibleCount);
                          const critCount = locked.filter(f => f.severity === "critical").length;
                          const warnCount = locked.filter(f => f.severity === "warning").length;
                          const infoCount = locked.filter(f => f.severity === "info").length;
                          // Unique locked categories
                          const lockedCats = [...new Set(locked.map(f => CATEGORY_META[f.category]?.label || f.category).filter(Boolean))];
                          return (
                            <>
                              <div className="grid grid-cols-3 gap-3">
                                {critCount > 0 && (
                                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                                    <div className="text-lg font-bold text-red-400">{critCount}</div>
                                    <div className="text-[10px] uppercase text-red-400/70">Critical</div>
                                  </div>
                                )}
                                {warnCount > 0 && (
                                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-center">
                                    <div className="text-lg font-bold text-yellow-400">{warnCount}</div>
                                    <div className="text-[10px] uppercase text-yellow-400/70">Warnings</div>
                                  </div>
                                )}
                                {infoCount > 0 && (
                                  <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 text-center">
                                    <div className="text-lg font-bold text-blue-400">{infoCount}</div>
                                    <div className="text-[10px] uppercase text-blue-400/70">Insights</div>
                                  </div>
                                )}
                              </div>

                              {lockedCats.length > 0 && (
                                <div>
                                  <p className="text-xs text-white/50 mb-2">Locked analysis covers:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {lockedCats.map(cat => (
                                      <span key={cat} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {(() => {
                          const TIER_UPGRADES: Record<string, { name: string; threshold: string; perks: string[] }> = {
                            FREE: {
                              name: "Tier 1 — Investigator",
                              threshold: "Pro",
                              perks: [
                                "6 AI agents with full analysis",
                                "Devil's Advocate peer review",
                                "Complete evidence locker",
                                "Cross-agent debate on disagreements",
                                "15 scans per day",
                              ],
                            },
                            TIER_1: {
                              name: "Tier 2 — Prosecutor",
                              threshold: "Pro+",
                              perks: [
                                "Upgraded AI models (Gemini 3 Pro, Grok 4)",
                                "VisionBot — screenshot & chart analysis",
                                "API access for bot integrations",
                                "Source citations in evidence locker",
                                "20 scans per day",
                              ],
                            },
                            TIER_2: {
                              name: "Tier 3 — Grand Jury",
                              threshold: "Premium",
                              perks: [
                                "Top-tier AI (Opus, GPT-5, Grok 4, Gemini Pro)",
                                "Real-time alerts on sentiment shifts",
                                "Priority queue — skip the line",
                                "Full debate transcripts",
                                "50 scans per day",
                              ],
                            },
                            TIER_3: {
                              name: "Consensus — Swarm Debate",
                              threshold: "Ultimate",
                              perks: [
                                "ALL models (Opus, GPT-5, Grok 4, Gemini Pro, Kimi)",
                                "Adversarial debate until consensus (CDI < 0.1)",
                                "Up to 5 debate rounds",
                                "Maximum accuracy & confidence",
                              ],
                            },
                          };
                          const next = TIER_UPGRADES[currentTier] || TIER_UPGRADES["FREE"];
                          return (
                            <>
                              <div className="border-t border-white/5 pt-4 space-y-2">
                                <p className="text-xs font-semibold text-white/70">{next.name}</p>
                                <ul className="text-xs text-white/50 space-y-1">
                                  {next.perks.map(p => (
                                    <li key={p} className="flex items-center gap-2">
                                      <span className="text-[#00D4AA]">✓</span> {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="text-center pt-2">
                                <Link
                                  href="/tiers"
                                  className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold text-black"
                                >
                                  Get $VSWARM — Unlock {next.name.split(" — ")[0]}
                                </Link>
                                <p className="mt-2 text-xs text-white/40">
                                  Hold {next.threshold} to upgrade
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {!showUpgradeDetails && (
                      <div className="text-center">
                        <Link
                          href="/tiers"
                          className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold text-black"
                        >
                          {currentTier === "FREE" ? "Upgrade to Tier 1" : "Upgrade to Next Tier"}
                        </Link>
                        <p className="mt-2 text-xs text-white/40">
                          Upgrade your tier to unlock deeper analysis
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Check if no critical/warnings visible */}
                {visibleCount > 0 &&
                 !sortedFindings.slice(0, visibleCount).some(f => f.severity === 'critical' || f.severity === 'warning') &&
                 sortedFindings.some(f => f.severity === 'critical' || f.severity === 'warning') && (
                  <p className="text-xs text-white/40 italic">
                    Critical issues may be present in locked findings.
                  </p>
                )}
                {visibleCount > 0 &&
                 !sortedFindings.slice(0, visibleCount).some(f => f.severity === 'critical' || f.severity === 'warning') &&
                 !sortedFindings.some(f => f.severity === 'critical' || f.severity === 'warning') && (
                  <p className="text-xs text-[#00D4AA]/70 italic">
                    No critical issues detected by available agents.
                  </p>
                )}
              </>
            );
          })()}

          {allFindings.length === 0 && (
            <p className="text-sm text-white/50">No detailed findings available.</p>
          )}
        </div>
      </Card>

      {/* Research Links */}
      {researchLinks.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔗</span>
            <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#00D4FF]">
              Verify It Yourself
            </h3>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {researchLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-[#00D4FF]/30 hover:bg-[#00D4FF]/10 hover:text-white"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Share Buttons (larger version at bottom) */}
      <div className="flex justify-end gap-3">
        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/verdict-card", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildCardPayload()),
              });
              if (!res.ok) throw new Error("Failed to generate card");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `verdictswarm-${token?.symbol || "scan"}.svg`;
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              // Fallback: copy URL
              void navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#6B46C1]/30 bg-[#6B46C1]/10 px-6 py-3 text-sm font-medium text-[#6B46C1] transition hover:bg-[#6B46C1]/20"
        >
          <span>🖼</span>
          Download Card
        </button>
        <button
          id="share-x-btn"
          onClick={() => {
            const name = token?.name || "Token";
            const sym = token?.symbol ? ` ($${token.symbol})` : "";
            const tweetText = [
              `🐝 ${name}${sym} scored ${result.score}/100 (Grade ${grade}) on VerdictSwarm`,
              "",
              `Free AI-powered token analysis → ${window.location.href}`,
              "",
              "@VswarmAi",
            ].join("\n");
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
            window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-6 py-3 text-sm font-medium text-[#00D4AA] transition hover:bg-[#00D4AA]/20"
        >
          <span>↗</span>
          Share on 𝕏
        </button>
      </div>

      {/* Change 5: "Scan Another Token" Button */}
      <div className="text-center mt-6">
        <Link
          href="/dapp"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition"
        >
          ← Scan another token
        </Link>
      </div>
    </div>
  );
}

/* ─── Scan Page ─── */

export default function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chainId?: string; chain?: string; tier?: string; fresh?: string }>;
}) {
  const { address } = use(params);
  const sp = use(searchParams);
  // Map chainId to chain name if chain param is missing
  const CHAIN_MAP: Record<string, string> = {
    "1": "ethereum", "8453": "base", "42161": "arbitrum",
    "10": "optimism", "137": "polygon", "56": "bsc", "43114": "avalanche",
  };
  const chain = sp.chain || (sp.chainId ? CHAIN_MAP[sp.chainId] || "base" : "base");

  // Tier detection: connected wallet = Tier 1 (Investigator), no wallet = Free (Scout)
  // Pre-token-launch: any connected wallet gets Tier 1 for demo/hackathon
  // URL override: ?tier=TIER_1 or ?tier=TIER_2 for testing
  const { connected: isConnected } = useWallet();
  // Check if user has a verified session (not just wallet connected)
  const [verified, setVerified] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setVerified(!!data?.user?.address);
          setWalletReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setWalletReady(true);
      });
    return () => { cancelled = true; };
  }, [isConnected]);
  const tier = sp.tier || (isConnected && verified ? "TIER_1" : "FREE");
  const fresh = sp.fresh === "true";

  const [phase, setPhase] = useState<"interrogation" | "results">("interrogation");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleComplete = useCallback((result: unknown) => {
    setScanResult(result as ScanResult);
    setPhase("results");
  }, []);

  // Pick up on-chain tx from localStorage (signing completes after onComplete due to Phantom approval delay)
  useEffect(() => {
    if (!scanResult || scanResult.onchainTx) return;
    const check = () => {
      try {
        const stored = localStorage.getItem(`vs:onchain:${address}`);
        if (stored) {
          const txData = JSON.parse(stored);
          if (txData?.txSignature) {
            setScanResult((prev) => prev ? { ...prev, onchainTx: txData } : prev);
            localStorage.removeItem(`vs:onchain:${address}`);
          }
        }
      } catch {}
    };
    // Poll every second for up to 30s (user may take time to approve in Phantom)
    const interval = setInterval(check, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [scanResult, address]);

  // Reset on address or tier change (wallet connect/disconnect)
  useEffect(() => {
    setPhase("interrogation");
    setScanResult(null);
  }, [address, tier]);

  return (
    <main className="py-6 md:py-10">
      {phase === "interrogation" && !walletReady && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-sm text-white/50 animate-pulse">Connecting wallet...</div>
        </div>
      )}

      {phase === "interrogation" && walletReady && (
        <InterrogationRoom
          key={tier}
          address={address}
          chain={chain}
          tier={tier}
          fresh={fresh}
          onComplete={handleComplete}
        />
      )}

      {phase === "results" && scanResult && (
        <ResultsView result={scanResult} currentTier={tier} />
      )}
    </main>
  );
}
