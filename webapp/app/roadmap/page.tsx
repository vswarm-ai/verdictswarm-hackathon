import Card from "@/components/ui/Card";
import Link from "next/link";

/* ─── Milestone Component ─── */

function Milestone({ title, desc, status, accent }: { title: string; desc: string; status: "done" | "active" | "upcoming"; accent: string }) {
  const icon = status === "done" ? "✅" : status === "active" ? "🔶" : "⬡";
  const opacity = status === "upcoming" ? "opacity-60" : "";
  return (
    <div className={`flex items-start gap-3 ${opacity}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <h4 className="text-sm font-bold" style={{ color: status === "upcoming" ? "rgba(255,255,255,0.5)" : accent }}>{title}</h4>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Phase Card ─── */

function PhaseCard({ phase, title, subtitle, accent, status, milestones, highlight }: {
  phase: string; title: string; subtitle: string; accent: string; status: string;
  milestones: { title: string; desc: string; status: "done" | "active" | "upcoming" }[];
  highlight?: boolean;
}) {
  return (
    <Card className={`p-6 space-y-4 ${highlight ? `border-[${accent}]/30` : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{phase}</div>
          <h3 className="font-orbitron text-xl font-bold mt-1">{title}</h3>
          <p className="text-xs text-white/40 mt-1">{subtitle}</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}30` }}>
          {status}
        </span>
      </div>
      <div className="space-y-3 pt-2 border-t border-[#2D2D3A]">
        {milestones.map((m, i) => (
          <Milestone key={i} {...m} accent={accent} />
        ))}
      </div>
    </Card>
  );
}

/* ─── Page ─── */

export default function RoadmapPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">

      {/* Hero */}
      <div className="text-center space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9945FF]">The Path Forward</p>
        <h1 className="font-orbitron text-3xl font-bold md:text-5xl">
          Roadmap
        </h1>
        <p className="text-white/50 max-w-xl mx-auto">
          From free scanner to the AI-powered security layer for all of crypto — built on Solana. 
          Here&apos;s where we are, and where we&apos;re going.
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 px-4 py-1.5 text-sm font-medium text-[#14F195]">
          <img src="/assets/solana/solana-logomark.svg" alt="Solana" className="h-4 w-4" />
          Built on Solana
        </span>
      </div>

      {/* You Are Here */}
      <div className="rounded-2xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-4 text-center">
        <span className="text-xs font-bold text-[#00D4AA] uppercase tracking-wider">📍 You Are Here — Phase 1: The Foundation (Nearly Complete)</span>
      </div>

      {/* Phase 1 */}
      <PhaseCard
        phase="Phase 1"
        title="The Foundation"
        subtitle="Build the product. Prove the AI works. Ship on Solana."
        accent="#00D4AA"
        status="NEARLY DONE"
        highlight
        milestones={[
          { title: "20+ specialized AI agents", desc: "Technician, Security, Tokenomics, Social Intel, Macro, Devil's Advocate, VisionBot, LLM ScamBot, Verdict Synthesizer, On-Chain Recorder", status: "done" },
          { title: "5 AI providers integrated", desc: "Google Gemini, xAI Grok, Moonshot Kimi, Anthropic Claude, OpenAI Codex — model-agnostic architecture", status: "done" },
          { title: "Adversarial Debate Protocol", desc: "Multi-model debate with Bayesian convergence when agents disagree by >2 points", status: "done" },
          { title: "Solana SPL token scanning", desc: "Native Solana token analysis via Helius RPC — on-chain data, holder analysis, program verification", status: "done" },
          { title: "Multi-chain support", desc: "Solana (native), Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Avalanche", status: "done" },
          { title: "The Interrogation Room UI", desc: "Real-time streaming UI — watch agents think, debate, and reach consensus with hex grid visualization", status: "done" },
          { title: "Free tier — Scout Scan", desc: "2 AI agents available to anyone, no wallet required, 3 scans/day", status: "done" },
          { title: "Evidence Locker + Verdict Cards", desc: "Detailed findings with shareable verdict cards and one-click share to 𝕏", status: "done" },
          { title: "B2A API + OpenClaw integration", desc: "SKILL.md for any AI agent to use VerdictSwarm — SSE streaming API", status: "done" },
          { title: "On-chain verdict storage", desc: "Solana Anchor program — every scan stored as immutable PDA on-chain", status: "active" },
          { title: "Docker one-command setup", desc: "docker compose up — full stack (frontend + backend + Redis) for easy evaluation", status: "done" },
          { title: "Pro tier launch", desc: "Wallet-gated access to full 6-agent adversarial analysis on Solana", status: "active" },
          { title: "Tier 1 — Investigator", desc: "6 agents + Devil's Advocate, Gemini Pro + Grok, multi-model debate, full evidence", status: "done" },
          { title: "Wallet authentication", desc: "Connect Solana wallet to unlock Pro tier analysis automatically", status: "done" },
          { title: "Continuous prompt optimization", desc: "Agent prompts refined with each model release — extracting maximum intelligence per provider", status: "done" },
        ]}
      />

      {/* Phase 2 */}
      <PhaseCard
        phase="Phase 2"
        title="Full Swarm & Token Economy"
        subtitle="Activate all tiers. Launch token economy. Reward the community."
        accent="#FFD700"
        status="NEXT"
        milestones={[
          { title: "API marketplace", desc: "Third-party protocols integrate VerdictSwarm consensus engine via API", status: "upcoming" },
          { title: "Usage-based pricing", desc: "Per-scan credit packs for power users — pay only for what you use", status: "upcoming" },
          { title: "Early Swarm Rewards", desc: "Airdrop and rewards for early community supporters", status: "upcoming" },
          { title: "Daily Verdict content series", desc: "Trending Solana token analysis posted daily — \"The Token Court\" format", status: "upcoming" },
          { title: "B2A partnerships", desc: "Free API keys for first 50 Solana AI agents — \"Security Data by VerdictSwarm\"", status: "upcoming" },
        ]}
      />

      {/* Phase 3 */}
      <PhaseCard
        phase="Phase 3"
        title="The Intelligence Network"
        subtitle="More models. More agents. The swarm gets smarter."
        accent="#6B46C1"
        status="LATER"
        milestones={[
          { title: "Tier 2 — Prosecutor", desc: "All agents + VisionBot, 5 AI providers at full power, adversarial multi-pass analysis", status: "upcoming" },
          { title: "Tier 3 — Grand Jury", desc: "Full 20+ agent swarm, unlimited scans, priority queue, on-chain verdicts", status: "upcoming" },
          { title: "Scan history dashboard", desc: "Personal dashboard with scan history, favorites, re-scan tracking, risk changes over time", status: "upcoming" },
          { title: "Accuracy tracking", desc: "Retroactive score tracking — did our verdicts predict outcomes? Public accuracy leaderboard", status: "upcoming" },
          { title: "Next-gen AI integration", desc: "Continuously upgrade to latest models as they release — architecture is model-agnostic", status: "upcoming" },
          { title: "Community feedback", desc: "Users vote on features, agent priorities, and new model integrations", status: "upcoming" },
          { title: "Community leaderboards", desc: "Top scanners, accuracy streaks, most rug pulls caught — badges and recognition", status: "upcoming" },
        ]}
      />

      {/* Phase 4 */}
      <PhaseCard
        phase="Phase 4"
        title="The Swarm Ecosystem"
        subtitle="One scanner becomes a network. The *swarm.io empire on Solana."
        accent="#FF8C00"
        status="VISION"
        milestones={[
          { title: "auditswarm.io", desc: "Deep smart contract auditing — line-by-line analysis, vulnerability detection, full audit reports", status: "upcoming" },
          { title: "launchswarm.io", desc: "Solana token launch analysis & scoring — evaluate new launches before they happen", status: "upcoming" },
          { title: "watchswarm.io", desc: "Portfolio monitoring & alerts — real-time risk changes, whale movements, program upgrades", status: "upcoming" },
          { title: "API marketplace", desc: "Developers build on VerdictSwarm data — bots, dashboards, integrations with rev share", status: "upcoming" },
          { title: "Cross-chain verdict aggregation", desc: "Unified security scores across all supported chains — one swarm, every chain", status: "upcoming" },
          { title: "Agent Commerce on Solana", desc: "VerdictSwarm agents transact with other Solana AI agents — hire experts, sell intelligence, on-chain payments", status: "upcoming" },
        ]}
      />

      {/* Always Evolving Note */}
      <Card className="p-5 border-[#00D4AA]/20">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🔄</span>
          <div>
            <h3 className="text-sm font-bold text-[#00D4AA]">This Roadmap Evolves</h3>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              AI moves fast, and so does Solana. This roadmap is a living document. 
              We prioritize based on what the community needs, what the market demands, and what the latest 
              AI breakthroughs make possible. Phases may shift, new opportunities may accelerate timelines. 
              Community members will have input on priorities.
            </p>
          </div>
        </div>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4 py-4">
        <h2 className="font-orbitron text-2xl font-bold">Ready to Join the Mission?</h2>
        <p className="text-sm text-white/40 max-w-md mx-auto">
          The foundation is built. The AI works. Now we need the community to take it to the next level.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 rounded-xl bg-[#9945FF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            🐝 Join The Swarm
          </Link>
          <Link
            href="/dapp"
            className="inline-flex items-center gap-2 rounded-xl bg-[#14F195] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#00E4BA]"
          >
            🔍 Try a Free Scan
          </Link>
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5"
          >
            𝕏 Follow @VswarmAi
          </a>
        </div>
      </div>
    </main>
  );
}
