import Card from "@/components/ui/Card";
import Link from "next/link";

export default function TiersPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          Swarm <span className="text-[#6B46C1]">Intelligence</span> Tiers
        </h1>
        <p className="text-white/50 max-w-xl mx-auto">
          More agents = more perspectives = better verdicts. Connect a Solana wallet to unlock the full adversarial swarm.
        </p>
      </div>

      {/* Tier Comparison Table */}
      <Card className="p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2D2D3A]">
              <th className="text-left py-3 pr-4 text-white/40 font-normal text-xs uppercase tracking-wider">Feature</th>
              <th className="py-3 px-4 text-center">
                <div className="text-white font-bold">Free</div>
                <div className="text-[10px] text-white/30 font-mono">Scout Scan</div>
              </th>
              <th className="py-3 px-4 text-center">
                <div className="text-[#00D4AA] font-bold">Tier 1</div>
                <div className="text-[10px] text-white/30 font-mono">Investigator</div>
              </th>
            </tr>
          </thead>
          <tbody className="text-white/60">
            {[
              { label: "Access", free: "No wallet needed", t1: "Connect Solana wallet" },
              { label: "Swarm Agents", free: "2 (Technician + Security)", t1: "6 + Devil's Advocate" },
              { label: "AI Models", free: "GPT-4o Mini, Claude Haiku", t1: "GPT-4o Mini, Claude Haiku, Gemini Flash, Gemini Pro, Grok" },
              { label: "Analysis Categories", free: "Technical + Safety", t1: "Technical, Safety, Tokenomics, Social, Macro, DA" },
              { label: "Debate Protocol", free: "—", t1: "✅ When agents disagree" },
              { label: "Evidence Depth", free: "5 findings shown", t1: "Full evidence locker" },
              { label: "On-Chain Storage", free: "—", t1: "✅ Verdict stored as Solana PDA" },
              { label: "Daily Scans", free: "3", t1: "15" },
              { label: "Accuracy Estimate", free: "~70%", t1: "~85%" },
              { label: "Avg Scan Time", free: "~10s", t1: "~20s" },
              { label: "Score Consistency", free: "±10–15%", t1: "±5–8%" },
            ].map((row, i) => (
              <tr key={i} className="border-b border-[#2D2D3A]/50">
                <td className="py-3 pr-4 text-xs text-white/80 font-medium">{row.label}</td>
                <td className="py-3 px-4 text-center text-xs">{row.free}</td>
                <td className="py-3 px-4 text-center text-xs text-[#00D4AA]">{row.t1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Technical Deep Dive */}
      <div className="space-y-6">
        <h2 className="font-orbitron text-xl font-bold text-center">Technical Deep Dive</h2>

        {/* Free Tier */}
        <Card className="p-6 border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔍</span>
            <div>
              <h3 className="font-orbitron text-lg font-bold">Free — Scout Scan</h3>
              <span className="text-xs text-white/30">No wallet required</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Swarm Agents (2)</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li className="flex items-center gap-2"><span className="text-[#00D4FF]">📊</span> <strong className="text-white/80">TechnicianBot</strong> — On-chain metrics, contract maturity, trading patterns</li>
                <li className="flex items-center gap-2"><span className="text-[#FF6B6B]">🔒</span> <strong className="text-white/80">SecurityBot</strong> — Smart contract audit, rug pull detection, honeypot scan</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> GPT-4o Mini (Technician) + Claude Haiku (Security)</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> 2-agent parallel analysis</li>
                <li>🎯 <strong className="text-white/70">Output:</strong> Score (0-100), Grade, evidence trail</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~10 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 p-3">
            <p className="text-xs text-[#FFD700]/70">
              <strong>Limitation:</strong> With 2 agents and no debate protocol, Scout Scans can miss nuances that
              full adversarial consensus catches. Scores may vary ±10–15% between runs.
            </p>
          </div>
        </Card>

        {/* Tier 1 */}
        <Card className="p-6 border-[#00D4AA]/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🐝</span>
            <div>
              <h3 className="font-orbitron text-lg font-bold text-[#00D4AA]">Tier 1 — Investigator</h3>
              <span className="text-xs text-white/30">Connect Solana wallet</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Swarm Agents (6 + DA)</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li className="flex items-center gap-2"><span className="text-[#00D4FF]">📊</span> <strong className="text-white/80">TechnicianBot</strong> — On-chain metrics &amp; pattern analysis</li>
                <li className="flex items-center gap-2"><span className="text-[#FF6B6B]">🔒</span> <strong className="text-white/80">SecurityBot</strong> — Contract audit &amp; vulnerability scan</li>
                <li className="flex items-center gap-2"><span className="text-[#FFD700]">💰</span> <strong className="text-white/80">TokenomicsBot</strong> — Supply, distribution, inflation analysis</li>
                <li className="flex items-center gap-2"><span className="text-[#6B46C1]">🐦</span> <strong className="text-white/80">SocialBot</strong> — Real-time X/social sentiment via Grok</li>
                <li className="flex items-center gap-2"><span className="text-[#00D4AA]">🌍</span> <strong className="text-white/80">MacroBot</strong> — Market conditions &amp; sector context</li>
                <li className="flex items-center gap-2"><span className="text-[#FF0055]">😈</span> <strong className="text-white/80">Devil&apos;s Advocate</strong> — Adversarial peer review of all agents</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">AI Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> GPT-4o Mini + Claude Haiku + Gemini Flash + Gemini Pro + Grok</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Parallel multi-agent with cross-referencing</li>
                <li>🔥 <strong className="text-white/70">Debate Protocol:</strong> Agents flag disagreements → real-time debate</li>
                <li>🔄 <strong className="text-white/70">Consensus:</strong> DA challenges strongest claim, 1-3 debate rounds</li>
                <li>🔗 <strong className="text-white/70">On-Chain:</strong> Verdict hash stored as Solana PDA</li>
                <li>🎯 <strong className="text-white/70">Accuracy:</strong> ~85% (multi-model + DA correction)</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~15-25 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#00D4AA]/5 border border-[#00D4AA]/20 p-3">
            <p className="text-xs text-[#00D4AA]/70">
              <strong>Key advantage:</strong> 5 different AI models from 4 providers catch different things.
              The debate protocol catches ~15% of errors that single-model analysis misses.
              On-chain verdict storage creates a permanent, verifiable record on Solana.
            </p>
          </div>
        </Card>
      </div>

      {/* Why More Intelligence Matters */}
      <Card className="p-6 border-[#FFD700]/20 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
        <h2 className="font-orbitron text-lg font-bold text-[#FFD700] mb-3">Why More Intelligence Matters</h2>
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">2→5</div>
            <div className="text-xs text-white/40 mt-1">AI Models</div>
            <p className="text-[10px] text-white/30 mt-1">Different models catch different things. Gemini excels at code, Grok at social data, Claude at reasoning.</p>
          </div>
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">2→6+DA</div>
            <div className="text-xs text-white/40 mt-1">Agents</div>
            <p className="text-[10px] text-white/30 mt-1">More perspectives = fewer blind spots. The Devil&apos;s Advocate forces every finding to be defended with evidence.</p>
          </div>
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">~70→85%</div>
            <div className="text-xs text-white/40 mt-1">Accuracy</div>
            <p className="text-[10px] text-white/30 mt-1">Each additional perspective narrows the error margin. Multi-agent debate outperforms any single model.</p>
          </div>
        </div>
      </Card>

      {/* Future */}
      <div className="text-center text-sm text-white/40">
        <p>Future tiers will scale up to 20+ agents with more advanced frontier models, real-time monitoring, and API access.</p>
      </div>

      {/* CTA */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/dapp" className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]">
          Start Scanning →
        </Link>
        <Link href="/dapp" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">
          Try Free Scan
        </Link>
      </div>
    </main>
  );
}
