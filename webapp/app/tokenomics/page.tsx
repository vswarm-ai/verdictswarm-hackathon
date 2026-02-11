import Card from "@/components/ui/Card";
import Link from "next/link";

export default function TokenomicsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          <span className="text-[#6B46C1]">$VSWARM</span> Tokenomics
        </h1>
        <p className="text-white/50 max-w-xl mx-auto">
          Hold to access. Use to burn. The swarm gets stronger as the community grows.
        </p>
      </div>

      {/* Supply */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-white">Supply</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
            <div className="font-orbitron text-3xl font-bold text-white">100M</div>
            <div className="text-xs text-white/40 mt-1">Total Supply</div>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
            <div className="font-orbitron text-3xl font-bold text-[#14F195]">Solana</div>
            <div className="text-xs text-white/40 mt-1">Network</div>
          </div>
        </div>
        <p className="text-xs text-white/40">
          $VSWARM launches on Solana. Contract address will be published at launch.
          No pre-mine, no team allocation, no VC rounds. 100% fair launch.
        </p>
      </Card>

      {/* Token-Gated Access */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-white">Token-Gated Access</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          $VSWARM isn&apos;t a subscription. It&apos;s <strong className="text-white/80">access through ownership</strong>.
          Hold tokens in your wallet to unlock higher swarm intelligence tiers. No recurring payments.
          No cancellation. You hold it, you have it.
        </p>
        <div className="space-y-3">
          {[
            { tier: "Free — Scout", tokens: "0", color: "#ffffff", desc: "2 agents, 3 scans/day, basic analysis" },
            { tier: "Tier 1 — Investigator", tokens: "~$100", color: "#00D4AA", desc: "6 agents + DA, 15 scans/day, full evidence + debates" },
            { tier: "Tier 2 — Prosecutor", tokens: "~$500", color: "#6B46C1", desc: "7 agents + VisionBot, 30 scans/day, API access", soon: true },
            { tier: "Tier 3 — Grand Jury", tokens: "~$2,000", color: "#FFD700", desc: "Full 20+ agent swarm, all 5 AI providers, 50 scans/day, priority API", soon: true },
            { tier: "Tier 4 — Consensus", tokens: "~$5,000", color: "#FF4500", desc: "Full multi-model debate: 4 frontier AIs argue to consensus, 5 debates/day", soon: true },
          ].map((t) => (
            <div key={t.tier} className="flex items-center justify-between rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
              <div>
                <span className="font-bold" style={{ color: t.color }}>{t.tier}</span>
                <p className="text-xs text-white/40 mt-0.5">{t.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm" style={{ color: t.color }}>
                  {t.tokens === "0" ? "Free" : `${t.tokens} $VSWARM`}
                </div>
                {t.soon && <span className="text-[10px] text-[#FFD700]">🔜 Coming</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href="/tiers" className="text-xs text-[#6B46C1] hover:text-[#7C3AED] transition">
            View detailed tier comparison →
          </Link>
        </div>
      </Card>

      {/* Burn Mechanics */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-[#FF6B6B]">🔥 Burn Mechanics</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          Every premium scan burns a small amount of $VSWARM — permanently reducing supply.
          More usage → more burns → more scarcity. The protocol gets more valuable as adoption grows.
        </p>
        <div className="rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4">
          <div className="grid gap-3 sm:grid-cols-3 text-center">
            <div>
              <div className="font-orbitron text-xl font-bold text-[#FF6B6B]">Per Scan</div>
              <div className="text-xs text-white/40 mt-1">Tokens burned on premium tiers</div>
            </div>
            <div>
              <div className="font-orbitron text-xl font-bold text-[#FFD700]">Deflationary</div>
              <div className="text-xs text-white/40 mt-1">Supply only goes down</div>
            </div>
            <div>
              <div className="font-orbitron text-xl font-bold text-[#00D4AA]">Positive-Sum</div>
              <div className="text-xs text-white/40 mt-1">Usage benefits all holders</div>
            </div>
          </div>
        </div>
      </Card>

      {/* The Flywheel */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-white">The Flywheel</h2>
        <div className="flex flex-col items-center gap-3 text-sm text-white/60">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#6B46C1]/20 px-4 py-2 text-[#6B46C1] font-bold">Users scan tokens</span>
            <span className="text-white/20">→</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#FF6B6B]/20 px-4 py-2 text-[#FF6B6B] font-bold">$VSWARM burns</span>
            <span className="text-white/20">→</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#FFD700]/20 px-4 py-2 text-[#FFD700] font-bold">Supply decreases</span>
            <span className="text-white/20">→</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#00D4AA]/20 px-4 py-2 text-[#00D4AA] font-bold">Token value grows</span>
            <span className="text-white/20">→</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#6B46C1]/20 px-4 py-2 text-[#6B46C1] font-bold">More users join</span>
            <span className="text-white/20">🔄</span>
          </div>
        </div>
      </Card>

      {/* B2A - Bot to Agent */}
      <Card className="p-6 space-y-4 border-[#00D4AA]/20">
        <h2 className="font-orbitron text-xl font-bold text-[#00D4AA]">B2A: The Bot-to-Agent Opportunity</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          Today, VerdictSwarm helps <strong className="text-white/80">humans</strong> analyze tokens faster.
          Tomorrow, we&apos;re the <strong className="text-white/80">security layer for every AI agent in crypto</strong>.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          When autonomous trading bots, DeFi agents, and portfolio managers trade billions,
          they&apos;ll need a verdict before execution. Every agent scan = $VSWARM burn.
          The AI agent economy is our biggest growth vector.
        </p>
        <div className="text-center">
          <Link href="/integrate" className="text-xs text-[#00D4AA] hover:text-[#00D4AA]/80 transition">
            Connect your AI agent →
          </Link>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="p-4 border-white/5">
        <p className="text-xs text-white/30 leading-relaxed">
          $VSWARM provides access to AI-powered analysis tools. It is not an investment product.
          Token value may fluctuate. VerdictSwarm verdicts are AI opinions, not financial advice.
          Crypto is volatile and risky. Always do your own research. Never invest more than you&apos;re
          prepared to lose.
        </p>
      </Card>

      {/* CTA */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/buy" className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]">
          Get $VSWARM →
        </Link>
        <Link href="/dapp" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">
          Try Free Scan
        </Link>
      </div>
    </main>
  );
}
