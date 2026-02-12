import Card from "@/components/ui/Card";
import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">Documentation</h1>
        <p className="text-white/50">Everything you need to understand and integrate VerdictSwarm.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/about">
          <Card className="p-6 h-full transition hover:border-[#6B46C1]/40">
            <span className="text-2xl">🐝</span>
            <h2 className="text-lg font-bold text-white mt-2">About</h2>
            <p className="text-sm text-white/50 mt-1">How the swarm works, the team, and why multi-model consensus matters.</p>
          </Card>
        </Link>

        <Link href="/tiers">
          <Card className="p-6 h-full transition hover:border-[#6B46C1]/40">
            <span className="text-2xl">⚡</span>
            <h2 className="text-lg font-bold text-white mt-2">Swarm Tiers</h2>
            <p className="text-sm text-white/50 mt-1">Technical deep dive: agents, AI models, debate protocols, and accuracy per tier.</p>
          </Card>
        </Link>

        <Link href="/integrate">
          <Card className="p-6 h-full transition hover:border-[#6B46C1]/40">
            <span className="text-2xl">🤖</span>
            <h2 className="text-lg font-bold text-white mt-2">Connect AI Agent</h2>
            <p className="text-sm text-white/50 mt-1">OpenClaw SKILL.md, API examples, and integration guides for bots and agents.</p>
          </Card>
        </Link>



        <Link href="/#faq">
          <Card className="p-6 h-full transition hover:border-[#6B46C1]/40">
            <span className="text-2xl">❓</span>
            <h2 className="text-lg font-bold text-white mt-2">FAQ</h2>
            <p className="text-sm text-white/50 mt-1">Common questions about VerdictSwarm, supported chains, AI models, on-chain verdicts, and token-gating.</p>
          </Card>
        </Link>
      </div>

      <Card className="p-6 space-y-3 border-[#6B46C1]/30 bg-[#6B46C1]/5">
        <h2 className="font-orbitron text-lg font-bold">How It Works: Proprietary Methodology</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          VerdictSwarm runs on a <span className="text-white/80 font-semibold">Proprietary Adversarial Consensus Engine</span> that coordinates
          specialized AI agents, adversarial debate loops, and evidence-weighted scoring to produce consistent risk verdicts.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          Our prompts and scoring methodology are continuously optimized, and the swarm is regularly upgraded with new frontier model releases.
          This is how VerdictSwarm stays state-of-the-art as the AI landscape moves.
        </p>
      </Card>

      {/* Quick Reference */}
      <Card className="p-6 space-y-3">
        <h2 className="font-orbitron text-lg font-bold">Quick Reference</h2>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between border-b border-[#2D2D3A]/50 py-2">
            <span className="text-white/50">Score Range</span>
            <span className="text-white/80 font-mono">0–100</span>
          </div>
          <div className="flex justify-between border-b border-[#2D2D3A]/50 py-2">
            <span className="text-white/50">Grades</span>
            <span className="text-white/80 font-mono">A, A-, B+, B, C, D, F</span>
          </div>
          <div className="flex justify-between border-b border-[#2D2D3A]/50 py-2">
            <span className="text-white/50">Chains</span>
            <span className="text-white/80 font-mono">Solana, Ethereum, Base, Arbitrum, Polygon, BSC</span>
          </div>
          <div className="flex justify-between border-b border-[#2D2D3A]/50 py-2">
            <span className="text-white/50">Free Tier</span>
            <span className="text-white/80">2 agents, 5 scans/day, no wallet needed</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-white/50">API Format</span>
            <span className="text-white/80 font-mono">SSE (Server-Sent Events)</span>
          </div>
        </div>
      </Card>
    </main>
  );
}
