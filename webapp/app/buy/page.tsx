"use client";

import Link from "next/link";

export default function BuyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="font-orbitron text-4xl font-bold md:text-5xl">
          Join <span className="text-[#6B46C1]">The Swarm</span>
        </h1>
        <p className="text-lg text-white/60 max-w-xl mx-auto">
          Hold <span className="font-bold text-white">$VSWARM</span> to unlock the full power of
          AI-powered token analysis. More agents. More accuracy. More alpha.
        </p>
      </div>

      {/* Progress / Graduation Banner */}
      <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-r from-[#FFD700]/5 to-[#FF8C00]/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚀</span>
          <div>
            <h2 className="text-lg font-bold text-[#FFD700]">Help Us Graduate</h2>
            <p className="text-sm text-white/50">
              $VSWARM launches on <strong className="text-white/70">Solana</strong>.
              Once we hit the graduation threshold, the token goes live on DEXs with full liquidity.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="inline-block h-2 w-2 rounded-full bg-[#FFD700] animate-pulse" />
          Early buyers get in at the lowest price — before graduation unlocks open trading
        </div>
      </div>

      {/* Buy Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Solana - Pre-Launch */}
        <div className="group rounded-2xl border border-[#6B46C1]/40 bg-[#6B46C1]/10 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚡</span>
            <h3 className="font-orbitron text-lg font-bold text-[#9945FF]">Solana</h3>
          </div>
          <p className="text-sm text-white/50 mb-4">
            $VSWARM launches on Solana. Follow us on 𝕏 to be first in line when the launch goes live.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://x.com/VswarmAi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#6B46C1] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
            >
              Follow for Launch Alert →
            </a>
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#6B46C1]/30 px-4 py-2 text-sm text-[#6B46C1] transition hover:bg-[#6B46C1]/10"
            >
              Explore Solana
            </a>
          </div>
        </div>

        {/* Uniswap - Greyed Out */}
        <div className="rounded-2xl border border-[#2D2D3A] bg-[#1A1A28]/30 p-6 opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl grayscale">🦄</span>
            <h3 className="font-orbitron text-lg font-bold text-white/40">Uniswap</h3>
          </div>
          <p className="text-sm text-white/30 mb-4">
            DEX trading unlocks after graduation. Hold tight — we&apos;re building momentum.
          </p>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#2D2D3A] px-4 py-2 text-sm font-bold text-white/30">
            🔒 Post-Graduation
          </span>
        </div>
      </div>

      {/* Tier Unlocks */}
      <div className="rounded-2xl border border-[#2D2D3A] bg-[#1A1A28]/50 p-6 space-y-5">
        <h2 className="font-orbitron text-xl font-bold text-white">What You Unlock</h2>
        <div className="space-y-4">
          {[
            {
              tier: "Free — Scout",
              tokens: "0",
              color: "#ffffff",
              perks: ["Instant scam/honeypot checks", "No AI agents", "3 scans / day"],
              active: true,
              badge: "✅ Live Now",
              badgeColor: "#00D4AA",
            },
            {
              tier: "Tier 1 — Investigator",
              tokens: "~$100 in $VSWARM",
              color: "#00D4AA",
              perks: ["6 AI agents (Gemini Flash, Grok 3, GPT-4o Mini)", "Devil's Advocate peer review", "Full evidence locker + debates", "15 scans / day"],
              active: true,
              badge: "✅ Live Now",
              badgeColor: "#00D4AA",
            },
            {
              tier: "Tier 2 — Prosecutor",
              tokens: "~$500 in $VSWARM",
              color: "#6B46C1",
              perks: ["Upgraded AI (Gemini Pro, Grok 4)", "VisionBot — screenshot & chart analysis", "API access for integrations", "30 scans / day"],
              active: false,
              badge: "🔜 Coming Soon",
              badgeColor: "#FFD700",
            },
            {
              tier: "Tier 3 — Grand Jury",
              tokens: "~$1,000 in $VSWARM",
              color: "#FF6B6B",
              perks: ["Top-tier AI (Opus, GPT-5, Grok 4)", "Real-time alerts + priority queue", "Full debate transcripts", "50 scans / day"],
              active: false,
              badge: "🔜 Coming Soon",
              badgeColor: "#FFD700",
            },
          ].map((t) => (
            <div
              key={t.tier}
              className={`rounded-xl border p-4 ${
                t.active
                  ? "border-white/10 bg-white/5"
                  : "border-[#2D2D3A] bg-[#0A0B0F]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold" style={{ color: t.color }}>{t.tier}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: t.badgeColor, background: `${t.badgeColor}15`, border: `1px solid ${t.badgeColor}30` }}>
                    {t.badge}
                  </span>
                </div>
                <span className="font-mono text-sm text-white/40">
                  {t.tokens === "0" ? "Free" : `Hold ${t.tokens} $VSWARM`}
                </span>
              </div>
              <ul className="space-y-1">
                {t.perks.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/50">
                    <span className="text-xs" style={{ color: t.color }}>✦</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Community / FOMO Section */}
      <div className="rounded-2xl border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-[#00D4AA]">🐝 Join The Swarm</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          VerdictSwarm isn&apos;t just a tool — it&apos;s a <strong className="text-white/70">community of smart money</strong> that
          refuses to ape blind. Every holder makes the swarm smarter. Every scan makes the AI more accurate.
          The earlier you join, the more you shape the protocol.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-[#00D4AA]">5+</div>
            <div className="text-xs text-white/40 mt-1">AI Agents</div>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-[#6B46C1]">Multi-Model</div>
            <div className="text-xs text-white/40 mt-1">Debate Consensus</div>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
            <div className="font-orbitron text-2xl font-bold text-[#FFD700]">$0</div>
            <div className="text-xs text-white/40 mt-1">Free Tier Forever</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2D2D3A] px-4 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            𝕏 Follow @VswarmAi
          </a>
          <Link
            href="/community"
            className="inline-flex items-center gap-2 rounded-lg bg-[#6B46C1] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            🐝 Join the Community
          </Link>
        </div>
      </div>

      {/* Back to Scan */}
      <div className="text-center pt-4">
        <Link
          href="/dapp"
          className="text-sm text-white/40 transition hover:text-white/60"
        >
          ← Back to Scanner
        </Link>
      </div>
    </div>
  );
}
