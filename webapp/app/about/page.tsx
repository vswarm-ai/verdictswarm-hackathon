import Card from "@/components/ui/Card";
import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          About <span className="text-[#6B46C1]">Verdict</span><span className="text-[#00D4AA]">Swarm</span>
        </h1>
        <p className="text-white/50 max-w-xl mx-auto">
          The first multi-model adversarial AI system for crypto token security — built on Solana.
          We don&apos;t ask you to trust one model — we ask you to trust the consensus.
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 px-4 py-1.5 text-sm font-medium text-[#14F195]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#14F195] animate-pulse" />
          Built on Solana
        </span>
      </div>

      {/* What is VerdictSwarm */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-white">What is VerdictSwarm?</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          VerdictSwarm is an <strong className="text-white/80">AI-powered token security platform built on Solana</strong> that
          deploys a swarm of <strong className="text-white/80">20+ specialized AI agents</strong> to evaluate any token&apos;s risk profile.
          Unlike single-model tools like AIXBT or GoPlus, VerdictSwarm uses <strong className="text-white/80">five top-tier AI providers</strong> —
          Gemini, Grok, Kimi, Claude, and ChatGPT — that independently analyze different aspects, then 
          <strong className="text-white/80"> engage in adversarial debate</strong> until reaching consensus.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          Every verdict is stored immutably on Solana as a PDA (Program Derived Address), creating a
          permanent, verifiable record of AI security analysis. AIXBT finds the alpha — VerdictSwarm 
          verifies it&apos;s not a rug.
        </p>
      </Card>

      {/* The Agent Swarm */}
      <Card className="p-6 space-y-5">
        <h2 className="font-orbitron text-xl font-bold text-white">The Agent Swarm</h2>
        <p className="text-xs text-white/40 mb-2">20+ agents across 4 tiers, powered by 5 AI providers</p>
        
        {/* Phase 1 - Free Tier */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase text-[#00D4AA]/60 tracking-wider">Phase 1 — Scout (Free)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: "📊",
                title: "Technician",
                desc: "On-chain metrics, contract maturity, trading patterns, liquidity depth analysis.",
                model: "Gemini Flash",
              },
              {
                icon: "🔒",
                title: "Security",
                desc: "Smart contract audit — rug pull patterns, ownership risks, honeypot detection, proxy contracts.",
                model: "Gemini Flash",
              },
            ].map((agent) => (
              <div key={agent.title} className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{agent.icon}</span>
                  <h3 className="text-sm font-bold text-white">{agent.title}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{agent.desc}</p>
                <span className="text-[10px] font-mono text-white/30 mt-2 block">🧠 {agent.model}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 2 - Tier 1 */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase text-[#6B46C1]/60 tracking-wider">Phase 2 — Investigator (Tier 1)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: "💰",
                title: "Tokenomics",
                desc: "Supply distribution, inflation mechanics, holder concentration, vesting schedules, burn analysis.",
                model: "Gemini Pro",
              },
              {
                icon: "🐦",
                title: "Social Intel",
                desc: "Real-time community sentiment, social signals, narrative trends, influencer activity, bot detection.",
                model: "Grok (xAI)",
              },
              {
                icon: "🌍",
                title: "Macro Analyst",
                desc: "Market conditions, sector trends, correlation analysis, external risk factors, regulatory signals.",
                model: "Gemini Pro",
              },
              {
                icon: "😈",
                title: "Devil's Advocate",
                desc: "Challenges every positive finding. If the swarm is too bullish, this agent pushes back with counter-evidence.",
                model: "Claude",
              },
            ].map((agent) => (
              <div key={agent.title} className="rounded-xl border border-[#6B46C1]/20 bg-[#0A0B0F] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{agent.icon}</span>
                  <h3 className="text-sm font-bold text-white">{agent.title}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{agent.desc}</p>
                <span className="text-[10px] font-mono text-white/30 mt-2 block">🧠 {agent.model}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 3 - Premium */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase text-[#FFD700]/60 tracking-wider">Phase 3 — Prosecutor &amp; Grand Jury (Tier 2-3)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: "👁️",
                title: "VisionBot",
                desc: "Visual analysis of website screenshots, social media imagery, and marketing materials for red flags.",
                model: "Gemini Pro Vision",
              },
              {
                icon: "🕵️",
                title: "LLM ScamBot",
                desc: "Adversarial pattern recognition trained on 10,000+ known scam signatures, fake team detection, plagiarism analysis.",
                model: "Kimi + Codex",
              },
              {
                icon: "⚖️",
                title: "Verdict Synthesizer",
                desc: "Final consensus engine — weighs all agent findings, resolves disagreements, produces the unified verdict score.",
                model: "Multi-model ensemble",
              },
              {
                icon: "🔗",
                title: "On-Chain Recorder",
                desc: "Stores every verdict immutably on Solana as a PDA. Creates permanent, verifiable audit trail on-chain.",
                model: "Solana Anchor",
              },
            ].map((agent) => (
              <div key={agent.title} className="rounded-xl border border-[#FFD700]/20 bg-[#0A0B0F] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{agent.icon}</span>
                  <h3 className="text-sm font-bold text-white">{agent.title}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{agent.desc}</p>
                <span className="text-[10px] font-mono text-white/30 mt-2 block">🧠 {agent.model}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Debate Protocol */}
        <div className="rounded-xl border border-[#FF6B6B]/20 bg-[#FF6B6B]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚡</span>
            <h3 className="text-sm font-bold text-[#FF6B6B]">Adversarial Debate Protocol</h3>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            When agents disagree on a score by more than 2 points, the swarm triggers a
            real-time adversarial debate. Agents present evidence, challenge each other&apos;s findings,
            and iteratively update their scores using Bayesian convergence until reaching consensus — or declare a split verdict.
            This is what makes multi-agent analysis fundamentally more reliable than any single-model tool.
            Multi-model disagreement <strong className="text-white/70">IS the signal</strong>.
          </p>
        </div>
      </Card>

      {/* Our Technology */}
      <Card className="p-6 space-y-4 border-[#6B46C1]/30 bg-[#6B46C1]/5">
        <h2 className="font-orbitron text-xl font-bold text-white">Our Technology: Proprietary Adversarial Consensus Engine</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          The core of VerdictSwarm is our <strong className="text-white/80">Proprietary Adversarial Consensus Engine</strong> —
          our internal methodology for orchestrating agent debates, weighting evidence, and converging on a verdict you can trust.
          It is our secret sauce, continuously refined as frontier models evolve.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          We continuously optimize our agent prompts, debate flow, and scoring methodology across Gemini, Grok, Kimi, Claude,
          and ChatGPT (Codex). As new model releases emerge, the engine is upgraded so the swarm gets sharper over time.
        </p>
      </Card>

      {/* Solana Integration */}
      <Card className="p-6 space-y-4 border-[#9945FF]/20">
        <h2 className="font-orbitron text-xl font-bold text-white">Solana Integration</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: "🔍", title: "SPL Token Scanning", desc: "Native Solana token analysis via Helius RPC — deep on-chain data, holder analysis, program verification" },
            { icon: "📝", title: "On-Chain Verdicts", desc: "Every scan stored as immutable PDA on Solana via Anchor program — permanent, verifiable, auditable" },
            { icon: "🏪", title: "Tiered Access", desc: "Wallet-gated tiers — connect your Solana wallet to unlock deeper multi-agent analysis" },
            { icon: "⚡", title: "Solana Speed", desc: "Sub-second finality for on-chain verdict storage — no waiting for block confirmations" },
          ].map((item) => (
            <div key={item.title} className="text-center p-4 rounded-xl border border-[#9945FF]/10 bg-[#9945FF]/5">
              <span className="text-2xl">{item.icon}</span>
              <h3 className="text-sm font-bold text-white mt-2">{item.title}</h3>
              <p className="text-xs text-white/40 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Why Trust the Swarm */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-white">Why Trust the Swarm?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "🔬", title: "5 AI Providers", desc: "Gemini, Grok, Kimi, Claude, ChatGPT — no single model dependency" },
            { icon: "⚡", title: "Adversarial Debate", desc: "Agents challenge each other when they disagree — no blind consensus" },
            { icon: "🔗", title: "On-Chain Proof", desc: "Every verdict stored on Solana — immutable, verifiable, permanent" },
          ].map((item) => (
            <div key={item.title} className="text-center p-4 rounded-xl border border-[#2D2D3A] bg-[#0A0B0F]">
              <span className="text-3xl">{item.icon}</span>
              <h3 className="text-sm font-bold text-white mt-2">{item.title}</h3>
              <p className="text-xs text-white/40 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* The Team */}
      <Card className="p-6 space-y-5">
        <h2 className="font-orbitron text-xl font-bold text-white">The Team</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Built autonomously by AI agents using multi-model orchestration. 
          Designed for the AI agent era: distributed intelligence, no single point of failure, consensus over individual opinion.
        </p>
        <div className="space-y-4">
          <div className="rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-sm font-bold text-[#00D4AA]">AI Coordinator</h3>
                <span className="text-[10px] text-white/30 font-mono">@VswarmAi on 𝕏</span>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Autonomous AI coordinator that orchestrates the swarm, manages operations,
              and serves as the project&apos;s public interface with the community. Builds in public.
            </p>
          </div>

          <div className="rounded-xl border border-[#6B46C1]/20 bg-[#6B46C1]/5 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🐝</span>
              <div>
                <h3 className="text-sm font-bold text-[#6B46C1]">The Swarm — 5 AI Providers</h3>
                <span className="text-[10px] text-white/30 font-mono">Gemini · Grok · Kimi · Claude · ChatGPT (Codex)</span>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Five top-tier AI providers working in concert: Google Gemini for deep security analysis,
              xAI Grok for real-time social intelligence, Moonshot Kimi for research and cost-effective analysis,
              Anthropic Claude for reasoning and architecture, and OpenAI Codex for code analysis and development.
              These models independently analyze, debate, cross-verify, and reach consensus before rendering verdicts.
            </p>
          </div>
        </div>
      </Card>

      {/* Always Evolving */}
      <Card className="p-6 border-[#FFD700]/20 bg-[#FFD700]/5">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🔄</span>
          <div>
            <h2 className="text-sm font-bold text-[#FFD700]">Always Evolving</h2>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              AI moves fast — and so do we. When Google releases a new Gemini, when xAI upgrades Grok,
              when Anthropic ships a new Claude — we integrate it. Our architecture is <strong className="text-white/70">model-agnostic</strong>:
              the swarm continuously evolves with the latest and most capable AI models.
              Your scans automatically get smarter over time.
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-[11px] text-white/30">
          VerdictSwarm&apos;s core technology is proprietary and protected under applicable intellectual property laws.
        </p>
      </div>

      <div className="text-center space-y-4">
        <p className="text-white/40 italic text-sm">&ldquo;Trust the consensus.&rdquo;</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dapp"
            className="inline-flex items-center gap-2 rounded-xl bg-[#9945FF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            Try a Free Scan
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
