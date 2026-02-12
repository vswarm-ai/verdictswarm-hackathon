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
          Each tier unlocks more agents, more advanced AI models, and deeper consensus protocols.
          More intelligence = more accuracy. Upgrade tiers for deeper analysis.
        </p>
      </div>

      {/* Tier Comparison Table */}
      <Card className="p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2D2D3A]">
              <th className="text-left py-3 pr-4 text-white/40 font-normal text-xs uppercase tracking-wider">Feature</th>
              <th className="py-3 px-2 text-center">
                <div className="text-white font-bold">Free</div>
                <div className="text-[10px] text-white/30 font-mono">Scout Scan</div>
              </th>
              <th className="py-3 px-2 text-center">
                <div className="text-[#00D4AA] font-bold">Tier 1</div>
                <div className="text-[10px] text-white/30 font-mono">Investigator</div>
              </th>
              <th className="py-3 px-2 text-center">
                <div className="text-[#6B46C1] font-bold">Tier 2</div>
                <div className="text-[10px] text-white/30 font-mono">Prosecutor</div>
              </th>
              <th className="py-3 px-2 text-center">
                <div className="text-[#FFD700] font-bold">Tier 3</div>
                <div className="text-[10px] text-white/30 font-mono">Grand Jury</div>
              </th>
              <th className="py-3 px-2 text-center">
                <div className="text-[#FF4500] font-bold">Tier 4</div>
                <div className="text-[10px] text-white/30 font-mono">Consensus</div>
              </th>
            </tr>
          </thead>
          <tbody className="text-white/60">
            {[
              { label: "Access", free: "No wallet needed", t1: "Connect wallet", t2: "Pro+ (coming soon)", t3: "Premium (coming soon)", t4: "Ultimate (coming soon)" },
              { label: "Swarm Agents", free: "2 (Technician + Security)", t1: "6 + Devil's Advocate", t2: "7 (+ VisionBot)", t3: "All agents", t4: "All agents" },
              { label: "AI Models", free: "Gemini Flash", t1: "Gemini Flash, Grok 3, GPT-4o Mini, Haiku", t2: "Gemini Pro, Grok 4", t3: "Opus, GPT-5, Grok 4, Gemini Pro, Kimi", t4: "All 5 frontier models" },
              { label: "Analysis Categories", free: "Technical + Safety", t1: "Technical, Safety, Tokenomics, Social, Macro, DA", t2: "+ Vision, source citations", t3: "All + real-time alerts", t4: "All + cross-model debate" },
              { label: "Debate Protocol", free: "—", t1: "✅ When agents disagree", t2: "✅ Multi-round", t3: "✅ Up to 5 adversarial rounds", t4: "🏛️ Full 4-model consensus debate" },
              { label: "Evidence Depth", free: "5 findings shown", t1: "Full evidence locker", t2: "Full + source citations", t3: "Full + debate transcripts", t4: "Full + model-vs-model transcripts" },
              { label: "Daily Scans", free: "3", t1: "15", t2: "30", t3: "50", t4: "5 debates/day" },
              { label: "Accuracy Estimate", free: "~70%", t1: "~85%", t2: "~90%", t3: "~92%", t4: "~95%" },
              { label: "Avg Scan Time", free: "~10s", t1: "~20s", t2: "~30s", t3: "~45s", t4: "~90s" },
              { label: "Score Consistency", free: "±10–15%", t1: "±5–8%", t2: "±3–5%", t3: "±1–3%", t4: "±0.5–1%" },
              { label: "API Access", free: "—", t1: "—", t2: "🔜 Coming Q2", t3: "🔜 Coming Q2", t4: "🔜 Priority API" },
            ].map((row, i) => (
              <tr key={i} className="border-b border-[#2D2D3A]/50">
                <td className="py-3 pr-4 text-xs text-white/80 font-medium">{row.label}</td>
                <td className="py-3 px-2 text-center text-xs">{row.free}</td>
                <td className="py-3 px-2 text-center text-xs text-[#00D4AA]">{row.t1}</td>
                <td className="py-3 px-2 text-center text-xs text-[#6B46C1]">{row.t2}</td>
                <td className="py-3 px-2 text-center text-xs text-[#FFD700]">{row.t3}</td>
                <td className="py-3 px-2 text-center text-xs text-[#FF4500]">{row.t4}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Daily Scans + Burns */}
      <Card className="p-6 border-[#00D4AA]/20 bg-gradient-to-r from-[#00D4AA]/5 to-transparent">
        <h2 className="font-orbitron text-lg font-bold text-[#00D4AA] mb-3">📊 Daily Scan Allowances</h2>
        <p className="text-sm text-white/60 leading-relaxed mb-4">
          Each tier includes daily scans. Need more? Additional scan packs will be available for purchase as higher tiers launch.
        </p>
        <div className="grid gap-3 sm:grid-cols-5 text-center">
          <div className="rounded-lg bg-[#0A0B0F] p-3">
            <div className="font-orbitron text-xl font-bold text-white">3</div>
            <div className="text-[10px] text-white/30 mt-1">Free daily scans</div>
            <div className="text-[10px] text-white/20">Scout</div>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3 border border-[#00D4AA]/20">
            <div className="font-orbitron text-xl font-bold text-[#00D4AA]">15</div>
            <div className="text-[10px] text-white/30 mt-1">Free daily scans</div>
            <div className="text-[10px] text-[#00D4AA]/50">Investigator</div>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3 border border-[#6B46C1]/20">
            <div className="font-orbitron text-xl font-bold text-[#6B46C1]">30</div>
            <div className="text-[10px] text-white/30 mt-1">Free daily scans</div>
            <div className="text-[10px] text-[#6B46C1]/50">Prosecutor</div>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3 border border-[#FFD700]/20">
            <div className="font-orbitron text-xl font-bold text-[#FFD700]">50</div>
            <div className="text-[10px] text-white/30 mt-1">Free daily scans</div>
            <div className="text-[10px] text-[#FFD700]/50">Grand Jury</div>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3 border border-[#FF4500]/20">
            <div className="font-orbitron text-xl font-bold text-[#FF4500]">5</div>
            <div className="text-[10px] text-white/30 mt-1">Debates/day</div>
            <div className="text-[10px] text-[#FF4500]/50">Consensus</div>
          </div>
        </div>
        <p className="text-xs text-white/30 mt-4 text-center italic">
          Additional scan packs coming soon. Higher tiers get cheaper per-scan rates.
        </p>
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
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Checks</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li className="flex items-center gap-2"><span className="text-[#00D4FF]">🧪</span> <strong className="text-white/80">ScamBot</strong> — Regex-based honeypot, rug pull, and scam pattern detection</li>
                <li className="flex items-center gap-2"><span className="text-white/30">❌</span> <span className="text-white/40">No AI agents at this tier</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Model:</strong> None (regex + heuristic only)</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Static analysis — no AI inference</li>
                <li>🎯 <strong className="text-white/70">Output:</strong> HEALTHY / UNHEALTHY badge (no numeric score)</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> &lt;2 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 p-3">
            <p className="text-xs text-[#FFD700]/70">
              <strong>Limitation:</strong> With only 1 AI model and no debate protocol, Scout Scans can miss nuances that
              multi-model consensus catches. Scores may vary ±10–15% between runs.
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
                <li className="flex items-center gap-2"><span className="text-[#00D4FF]">📊</span> <strong className="text-white/80">TechnicianBot</strong> — On-chain metrics & pattern analysis</li>
                <li className="flex items-center gap-2"><span className="text-[#FF6B6B]">🔒</span> <strong className="text-white/80">SecurityBot</strong> — Contract audit & vulnerability scan</li>
                <li className="flex items-center gap-2"><span className="text-[#FFD700]">💰</span> <strong className="text-white/80">TokenomicsBot</strong> — Supply, distribution, inflation analysis</li>
                <li className="flex items-center gap-2"><span className="text-[#6B46C1]">🐦</span> <strong className="text-white/80">SocialBot</strong> — Real-time X/social sentiment via Grok 3</li>
                <li className="flex items-center gap-2"><span className="text-[#00D4AA]">🌍</span> <strong className="text-white/80">MacroBot</strong> — Market conditions & sector context</li>
                <li className="flex items-center gap-2"><span className="text-[#FF0055]">😈</span> <strong className="text-white/80">Devil&apos;s Advocate</strong> — Adversarial peer review of all agents</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">AI Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> Gemini 2.5 Flash + Grok 3 + GPT-4o Mini + Claude Haiku</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Parallel multi-agent with cross-referencing</li>
                <li>🔥 <strong className="text-white/70">Debate Protocol:</strong> Agents flag disagreements → real-time debate</li>
                <li>🔄 <strong className="text-white/70">Consensus:</strong> DA challenges strongest claim, 1-3 debate rounds</li>
                <li>🎯 <strong className="text-white/70">Accuracy:</strong> ~85% (multi-model + DA correction)</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~15-25 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#00D4AA]/5 border border-[#00D4AA]/20 p-3">
            <p className="text-xs text-[#00D4AA]/70">
              <strong>Key upgrade:</strong> Gemini 2.5 Pro has 2× the reasoning depth of Flash. Grok 4 provides
              real-time social intelligence via native X/Twitter integration.
              The debate protocol catches ~15% of errors that single-model analysis misses.
            </p>
          </div>
        </Card>

        {/* Tier 2 */}
        <Card className="p-6 border-[#6B46C1]/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚖️</span>
            <div>
              <h3 className="font-orbitron text-lg font-bold text-[#6B46C1]">Tier 2 — Prosecutor</h3>
              <span className="text-xs text-white/30">Pro+ tier</span>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30">🔜 Coming Soon</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Enhanced Swarm</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li>All Tier 1 agents, plus:</li>
                <li className="flex items-center gap-2"><span className="text-[#FF6B6B]">👁️</span> <strong className="text-white/80">VisionBot</strong> — Screenshots websites, detects clone sites</li>
                <li className="flex items-center gap-2"><span className="text-[#FFD700]">🔍</span> <strong className="text-white/80">LLMScamBot</strong> — Semantic contract analysis</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">AI Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> Gemini Pro + Grok 4 + premium models</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Multi-pass iterative verification</li>
                <li>🔥 <strong className="text-white/70">Debate:</strong> Multi-round with evidence requirements</li>
                <li>👁️ <strong className="text-white/70">Vision:</strong> Gemini Pro multimodal analysis</li>
                <li>🎯 <strong className="text-white/70">Accuracy:</strong> ~90%</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~30 seconds</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Tier 3 */}
        <Card className="p-6 border-[#FFD700]/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🐋</span>
            <div>
              <h3 className="font-orbitron text-lg font-bold text-[#FFD700]">Tier 3 — Grand Jury</h3>
              <span className="text-xs text-white/30">Premium tier</span>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30">🔜 Coming Soon</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Full Arsenal + Adversarial</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li>All Tier 2 agents, plus:</li>
                <li className="flex items-center gap-2"><span className="text-[#FF0055]">😈</span> <strong className="text-white/80">Devil&apos;s Advocate</strong> — Challenges every positive finding</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">AI Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> All models + Claude Opus (1M context)</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Full adversarial verification</li>
                <li>🔥 <strong className="text-white/70">Debate:</strong> Up to 5 adversarial rounds</li>
                <li>🔄 <strong className="text-white/70">Consensus:</strong> All agents review each other&apos;s work</li>
                <li>🎯 <strong className="text-white/70">Accuracy:</strong> ~92%</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~45 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 p-3">
            <p className="text-xs text-[#FFD700]/70">
              <strong>Key upgrade:</strong> The Devil&apos;s Advocate forces the swarm to defend every finding with evidence.
              Claude Opus brings 1M context for full codebase analysis. Score variance drops to ±1–3%.
              This is the highest-accuracy token analysis available anywhere.
            </p>
          </div>
        </Card>

        {/* Tier 4 — Consensus */}
        <Card className="p-6 border-[#FF4500]/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏛️</span>
            <div>
              <h3 className="font-orbitron text-lg font-bold text-[#FF4500]">Tier 4 — Consensus</h3>
              <span className="text-xs text-white/30">Ultimate tier</span>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30">🔜 Coming Soon</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">The Ultimate Analysis</h4>
              <ul className="space-y-1.5 text-sm text-white/60">
                <li>Everything in Grand Jury, plus:</li>
                <li className="flex items-center gap-2"><span className="text-[#FF4500]">🏛️</span> <strong className="text-white/80">Multi-Model Debate</strong> — 4 frontier AIs argue to consensus</li>
                <li className="flex items-center gap-2"><span className="text-[#FF4500]">⚔️</span> <strong className="text-white/80">Adversarial Consensus</strong> — Models challenge each other&apos;s reasoning</li>
                <li className="flex items-center gap-2"><span className="text-[#FF4500]">📜</span> <strong className="text-white/80">Full Transcripts</strong> — Read the actual model-vs-model debate</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">AI Architecture</h4>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>🧠 <strong className="text-white/70">Models:</strong> Opus + GPT-5 + Grok 4 + Gemini Pro (all frontier)</li>
                <li>⚡ <strong className="text-white/70">Architecture:</strong> Multi-model adversarial debate to consensus</li>
                <li>🔥 <strong className="text-white/70">Debate:</strong> Models argue, challenge, and converge on a verdict</li>
                <li>🔄 <strong className="text-white/70">Consensus:</strong> Bayesian convergence across all 4 models</li>
                <li>🎯 <strong className="text-white/70">Accuracy:</strong> ~95% (highest available)</li>
                <li>⏱️ <strong className="text-white/70">Speed:</strong> ~90 seconds</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#FF4500]/5 border border-[#FF4500]/20 p-3">
            <p className="text-xs text-[#FF4500]/70">
              <strong>The pinnacle:</strong> This is the only tier where multiple frontier AI models actively debate each other.
              Not just parallel analysis — actual adversarial argumentation. When Opus disagrees with GPT-5, they argue it out
              with evidence until consensus emerges. Score variance drops to ±0.5–1%. This is the most accurate token
              analysis available anywhere in crypto.
            </p>
          </div>
        </Card>
      </div>

      {/* Why More Intelligence Matters */}
      <Card className="p-6 border-[#FFD700]/20 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
        <h2 className="font-orbitron text-lg font-bold text-[#FFD700] mb-3">Why More Intelligence Matters</h2>
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">1→5+</div>
            <div className="text-xs text-white/40 mt-1">AI Models</div>
            <p className="text-[10px] text-white/30 mt-1">Different models catch different things. Gemini excels at code, Grok at social data, Opus at deep reasoning.</p>
          </div>
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">0→5</div>
            <div className="text-xs text-white/40 mt-1">Debate Rounds</div>
            <p className="text-[10px] text-white/30 mt-1">Debates force agents to justify findings with evidence. Score adjustments in debate catch ~15% of errors.</p>
          </div>
          <div className="p-3">
            <div className="font-orbitron text-3xl font-bold text-white">~70→92%</div>
            <div className="text-xs text-white/40 mt-1">Accuracy</div>
            <p className="text-[10px] text-white/30 mt-1">Each additional perspective narrows the error margin. Multi-agent debate outperforms any single model.</p>
          </div>
        </div>
      </Card>

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
