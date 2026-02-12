import Link from "next/link";
import Card from "@/components/ui/Card";

/* ───────────────────── Grade Color Helper ───────────────────── */
function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-[#00D4AA]";
  if (grade.startsWith("B") || grade.startsWith("C")) return "text-[#FFD700]";
  return "text-[#FF0055]";
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return "border-[#00D4AA]/40 bg-[#00D4AA]/10";
  if (grade.startsWith("B") || grade.startsWith("C")) return "border-[#FFD700]/40 bg-[#FFD700]/10";
  return "border-[#FF0055]/40 bg-[#FF0055]/10";
}

/* ───────────────────── Hexagon BG Pattern (inline SVG) ───────── */
function HexPattern() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,15 58,37 30,50 2,37 2,15' fill='none' stroke='%236B46C1' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "60px 52px",
      }}
    />
  );
}

/* ───────────────────── Social Proof Ticker ───────────────────── */
function SocialProofTicker() {
  const items = [
    { ticker: "$JUP", grade: "A-" },
    { ticker: "$BONK", grade: "B+" },
    { ticker: "$WIF", grade: "B" },
    { ticker: "$RAY", grade: "A" },
    { ticker: "$ORCA", grade: "A-" },
    { ticker: "$PYTH", grade: "A" },
    { ticker: "$JTO", grade: "B+" },
    { ticker: "$PEPE", grade: "B" },
    { ticker: "$LINK", grade: "A-" },
    { ticker: "$AAVE", grade: "A" },
  ];
  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-[#2D2D3A]/60 bg-black/30 py-3">
      <div className="animate-ticker flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="mx-6 inline-flex items-center gap-2 text-sm">
            <span className="font-mono-jb text-white/80">{item.ticker}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-bold border ${gradeBg(item.grade)} ${gradeColor(item.grade)}`}
            >
              {item.grade}
            </span>
            <span className="text-white/20">//</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────── Landing Page ───────────────────────────── */
export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ─── HERO SECTION ─── */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 py-20 text-center">
        <HexPattern />

        {/* Purple/cyan radial glows */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
          <div className="h-[500px] w-[500px] rounded-full bg-[#6B46C1]/15 blur-[120px]" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2">
          <div className="h-[400px] w-[400px] rounded-full bg-[#00D4AA]/10 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <h1
            className="font-orbitron text-4xl font-bold uppercase leading-tight tracking-wide md:text-6xl lg:text-7xl"
          >
            <span className="text-white">AI Agents That Disagree</span>
            <br />
            <span className="gradient-text">So You Don&apos;t Have To</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#00D4AA]/90 md:text-xl">
            The Institutional-Grade Audit Swarm for Degens.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-white/55">
            Powered by our <span className="text-white/80 font-semibold">Proprietary Adversarial Consensus Engine</span> — the secret sauce
            behind our adversarial debate, prompt strategy, and continuously upgraded scoring system.
          </p>

          {/* Built on Solana Badge */}
          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 px-4 py-1.5 text-sm font-medium text-[#14F195]">
              <img src="/assets/solana/solana-logomark.svg" alt="Solana" className="h-4 w-4" />
              Built on Solana
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dapp"
              className="btn-primary inline-flex h-14 items-center justify-center rounded-xl px-10 text-base font-bold uppercase tracking-wider text-black"
            >
              Scan Token Now
            </Link>
            <Link
              href="/tiers"
              className="btn-secondary inline-flex h-14 items-center justify-center rounded-xl px-10 text-base font-bold uppercase tracking-wider"
            >
              View Plans
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF STRIP ─── */}
      <SocialProofTicker />

      {/* ─── THE REVEAL SECTION ─── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B46C1]">
              Why VerdictSwarm?
            </p>
            <h2 className="font-orbitron mt-4 text-3xl font-bold uppercase md:text-4xl">
              Human Audit vs Swarm Audit
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Human Audit Card */}
            <Card className="relative overflow-hidden p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF0055]/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="text-sm font-bold uppercase tracking-wider text-[#FF0055]">
                  Human Audit
                </div>
                <div className="mt-4 space-y-4 text-sm text-white/70">
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF0055]">✗</span>
                    <span>Weeks to months turnaround</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF0055]">✗</span>
                    <span>Single auditor bias</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF0055]">✗</span>
                    <span>$10K–$50K per audit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF0055]">✗</span>
                    <span>Static report, outdated by next commit</span>
                  </div>
                </div>
                <div className="mt-8 rounded-xl border border-[#FF0055]/30 bg-[#FF0055]/10 p-4 text-center">
                  <div className="font-orbitron text-4xl font-bold text-[#FF0055]">F</div>
                  <div className="mt-1 text-xs text-white/50">Grade: Slow & Expensive</div>
                </div>
              </div>
            </Card>

            {/* Swarm Audit Card */}
            <Card className="relative overflow-hidden p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#00D4AA]/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="text-sm font-bold uppercase tracking-wider text-[#00D4AA]">
                  Swarm Audit
                </div>
                <div className="mt-4 space-y-4 text-sm text-white/70">
                  <div className="flex items-center gap-3">
                    <span className="text-[#00D4AA]">✓</span>
                    <span>30 seconds — instant verdict</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#00D4AA]">✓</span>
                    <span>Multiple AI agents debate & cross-check</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#00D4AA]">✓</span>
                    <span>Free tier available, premium from $0</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#00D4AA]">✓</span>
                    <span>Real-time — scans live contract state</span>
                  </div>
                </div>
                <div className="mt-8 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/10 p-4 text-center">
                  <div className="font-orbitron text-4xl font-bold text-[#00D4AA]">A-</div>
                  <div className="mt-1 text-xs text-white/50">Grade: Fast & Transparent</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>


      {/* ─── THE SECRET SAUCE: INTERROGATION ROOM ─── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF0055]">
              The Secret Sauce
            </p>
            <h2 className="font-orbitron mt-4 text-3xl font-bold uppercase md:text-4xl">
              The Interrogation Room
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/50">
              Watch AI agents analyze your token in real-time. They don&apos;t just scan — they
              think, challenge each other, and debate until they reach consensus.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00D4FF]/10 text-3xl">🔍</div>
              <h3 className="font-bold text-[#00D4FF]">Phase 1: Recon</h3>
              <p className="mt-2 text-xs text-white/50">Technician &amp; Security agents independently scan on-chain data, contract code, and liquidity via Helius RPC. Zero groupthink.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6B46C1]/10 text-3xl">🧠</div>
              <h3 className="font-bold text-[#6B46C1]">Phase 2: Deep Analysis</h3>
              <p className="mt-2 text-xs text-white/50">Tokenomics, Social Intel, and Macro agents layer in market data, holder behavior, sentiment, and sector trends. Devil&apos;s Advocate challenges everything.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF0055]/10 text-3xl">⚡</div>
              <h3 className="font-bold text-[#FF0055]">Phase 3: Adversarial Debate</h3>
              <p className="mt-2 text-xs text-white/50">When agents disagree by &gt;2 points, they enter real-time debate — presenting evidence, challenging findings, converging via Bayesian updating.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00D4AA]/10 text-3xl">🔗</div>
              <h3 className="font-bold text-[#00D4AA]">Phase 4: Verdict &amp; On-Chain</h3>
              <p className="mt-2 text-xs text-white/50">The swarm converges on a consensus score (0-100) backed by all agents. Verdict is stored immutably on Solana as a PDA — permanent, verifiable proof.</p>
            </Card>
          </div>

          {/* Terminal Preview */}
          <div className="mt-10 mx-auto max-w-2xl">
            <div className="rounded-lg border border-[#2D2D3A] bg-black/80 p-4 font-mono text-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2D2D3A]">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-white/30 ml-2">SWARM TERMINAL — LIVE</span>
              </div>
              <div className="space-y-1.5 text-white/70">
                <div><span className="text-cyan-400">●</span> Scan initiated for $PEPE on Ethereum</div>
                <div><span className="text-[#00D4FF]">📊 Technician:</span> <span className="text-green-400">Analyzing on-chain metrics...</span></div>
                <div><span className="text-[#00D4AA]">🔒 Security:</span> <span className="text-green-400">Contract source code is verified ✓</span></div>
                <div><span className="text-[#00D4FF]">📊 Technician:</span> <span className="text-green-400">Mature contract — 1025 days old</span></div>
                <div><span className="text-[#00D4AA]">🔒 Security:</span> <span className="text-yellow-400">⚠ Ownership not renounced</span></div>
                <div><span className="text-[#FFD700]">💰 Tokenomics:</span> <span className="text-[#6B46C1]">🔒 Upgrade to see full analysis</span></div>
                <div><span className="text-red-400">⚡ DISAGREEMENT: Safety score differs by 2.5 points</span></div>
                <div><span className="text-cyan-400">●</span> <span className="text-[#00D4AA]">🐝 Verdict: 73/100 (Grade B)</span></div>
              </div>
              <div className="mt-2 text-green-400 animate-pulse">█</div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/dapp" className="text-sm text-[#6B46C1] hover:text-[#7C3AED] transition">
              Try it live → Paste any contract address
            </Link>
          </div>
        </div>
      </section>

      {/* ─── TIER GRID ─── */}
      <section className="relative px-4 py-20">
        <HexPattern />
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B46C1]">Swarm Intelligence Tiers</p>
            <h2 className="font-orbitron mt-4 text-3xl font-bold uppercase md:text-4xl">More Agents. Smarter Models. Better Verdicts.</h2>
          </div>

          <div className="relative mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <Card className="p-8">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60">Scout</div>
              <div className="mt-2 text-2xl font-bold text-white">Free</div>
              <div className="mt-1 text-sm text-white/50">No wallet needed</div>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Instant scam &amp; honeypot detection</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>HEALTHY / UNHEALTHY verdict</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>3 scans per day</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>2 AI agents (Technician + Security)</span></li>
              </ul>
              <Link href="/dapp" className="mt-8 block w-full rounded-xl border border-[#2D2D3A] bg-[#1A1A28] py-3 text-center text-sm font-medium text-white/80 transition hover:border-[#6B46C1]/40 hover:bg-[#6B46C1]/10">Scan Free</Link>
            </Card>

            <Card className="relative overflow-hidden p-8 border-[#FFD700]/30">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#6B46C1]/15 via-transparent to-[#00D4AA]/10" />
              <div className="absolute -right-2 top-4 rotate-12 rounded-full bg-[#FFD700] px-3 py-1 text-xs font-bold text-black">Most Popular</div>
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">Investigator</div>
                <div className="mt-2 text-2xl font-bold text-white">Pro</div>
                <div className="mt-1 text-sm text-white/50">Wallet-gated access</div>
                <ul className="mt-6 space-y-3 text-sm text-white/70">
                  <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>6 AI agents + Devil&apos;s Advocate</span></li>
                  <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Gemini Flash + Grok 3 + GPT-4o Mini</span></li>
                  <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Cross-agent debates + DA peer review</span></li>
                  <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Full evidence locker + share cards</span></li>
                </ul>
                <Link href="/tiers" className="btn-primary mt-8 block w-full rounded-xl py-3 text-center text-sm font-bold text-black">Get Started</Link>
              </div>
            </Card>

            <Card className="p-8">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60">Prosecutor</div>
              <div className="mt-2 text-2xl font-bold text-white">Pro+</div>
              <div className="mt-1 text-sm text-[#FFD700]">🔜 Coming Soon</div>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>All agents + VisionBot</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Upgraded AI (Gemini Pro, Grok 4)</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>API access + source citations</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>30 scans / day</span></li>
              </ul>
              <div className="mt-8 w-full rounded-xl border border-[#2D2D3A] bg-[#1A1A28] py-3 text-center text-sm font-medium text-white/40">Coming Soon</div>
            </Card>

            <Card className="p-8 border-[#FF6B6B]/20">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF6B6B]">Grand Jury</div>
              <div className="mt-2 text-2xl font-bold text-white">Premium</div>
              <div className="mt-1 text-sm text-[#FFD700]">🔜 Coming Soon</div>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Full 20+ agent swarm</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>All 5 AI providers at max tier</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Multi-pass adversarial analysis</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>On-chain verdict storage on Solana</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Unlimited scans + priority queue</span></li>
              </ul>
              <div className="mt-8 w-full rounded-xl border border-[#2D2D3A] bg-[#1A1A28] py-3 text-center text-sm font-medium text-white/40">Coming Soon</div>
            </Card>

            <Card className="p-8 border-[#FF4500]/20">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF4500]">🏛️ Consensus</div>
              <div className="mt-2 text-2xl font-bold text-white">Ultimate</div>
              <div className="mt-1 text-sm text-[#FFD700]">🔜 Coming Soon</div>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>4 frontier AIs debate to consensus</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Opus + GPT-5 + Grok 4 + Gemini Pro</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>Full debate transcripts</span></li>
                <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span><span>~95% accuracy, ±0.5–1% variance</span></li>
              </ul>
              <div className="mt-8 w-full rounded-xl border border-[#2D2D3A] bg-[#1A1A28] py-3 text-center text-sm font-medium text-white/40">Coming Soon</div>
            </Card>
          </div>

          <div className="mt-6 text-center">
            <Link href="/tiers" className="text-xs text-[#6B46C1] hover:text-[#7C3AED] transition">View full technical comparison →</Link>
          </div>
        </div>
      </section>

      {/* ─── AI AGENT / OPENCLAW SECTION ─── */}
      <section className="relative px-4 py-20 bg-gradient-to-b from-transparent to-[#6B46C1]/5">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00D4AA]">Bot-to-Agent (B2A)</p>
          <h2 className="font-orbitron mt-4 text-3xl font-bold uppercase md:text-4xl">Your AI Agent&apos;s Security Layer</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/50">Give your trading bot, OpenClaw agent, or automation swarm-level intelligence. One API call before every trade.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/integrate" className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]">🤖 Connect Your Agent</Link>
            <Link href="/integrate" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">🐾 OpenClaw Guide</Link>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <div id="faq" />
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-orbitron text-2xl font-bold uppercase text-center md:text-3xl">FAQ</h2>
          <div className="mt-10 space-y-4">
            {[
              { q: "What is VerdictSwarm?", a: "An AI-powered token security platform built on Solana that deploys specialized AI agents to evaluate any token's risk. The agents independently analyze on-chain data, market signals, and social sentiment — then engage in adversarial debate until reaching consensus. Think of it as a courtroom trial for every token, with AI prosecutors, defenders, and a jury." },
              { q: "How is this different from other scanners?", a: "Most scanners use a single model or static rules. VerdictSwarm runs a Proprietary Adversarial Consensus Engine that coordinates specialized AI agents powered by Gemini, Grok, Kimi, Claude, and ChatGPT (Codex). Agents independently analyze, cross-check, and enter adversarial debate when they disagree — then converge using our proprietary scoring methodology. This multi-model approach consistently outperforms single-model analysis, and every verdict is stored immutably on Solana." },
              { q: "Is the free tier actually free?", a: "Yes. No wallet, no signup, no catch. Paste any Solana SPL token address or EVM contract address and get a real AI-powered analysis with 2 agents. Free forever — we want you to see the quality before upgrading." },
              { q: "How do I upgrade to higher tiers?", a: "Connect your Solana wallet to access Pro tier with 6 agents + adversarial debate. Higher tiers with 20+ agents and frontier AI models are coming soon. Free tier requires no wallet — just paste an address and scan." },
              { q: "What AI models power the swarm?", a: "Five top-tier AI providers: Google Gemini (security analysis), xAI Grok (social signals & sentiment), Moonshot Kimi (research & deep analysis), Anthropic Claude (reasoning & architecture), and OpenAI Codex (code analysis). We continuously upgrade to the latest models — our architecture is model-agnostic, so when a better model drops, we integrate it immediately." },
              { q: "Can my AI agent/bot use VerdictSwarm?", a: "Absolutely — this is our B2A (Bot-to-Agent) play. Drop our SKILL.md into your OpenClaw agent, or use the SSE API directly. Your Solana trading bot gets swarm intelligence before every trade. One API call, instant verdict." },
              { q: "What chains are supported?", a: "Solana (native, first-class support), Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, and Avalanche. Solana token scanning uses Helius RPC for deep on-chain analysis." },
              { q: "How accurate is it?", a: "Free (2 agents): ~70%. Tier 1 Investigator (6 agents + Devil's Advocate + debate): ~85%. Tier 2 Prosecutor (adversarial multi-pass): ~90%. Tier 3 Grand Jury (full swarm): ~92%. Tier 4 Consensus (4 frontier AIs debate to consensus): ~95%. Accuracy improves continuously as we integrate newer, smarter AI models and expand on-chain data sources." },
              { q: "Are verdicts stored on-chain?", a: "Yes — every scan verdict is stored as an immutable PDA (Program Derived Address) on Solana via our Anchor program. This creates a verifiable, permanent record of AI security analysis that anyone can audit on Solana Explorer." },
              { q: "Do you keep up with new AI models?", a: "Yes — this is core to our value. AI evolves weekly. When Google releases a new Gemini, when xAI upgrades Grok, when Anthropic ships a new Claude — we integrate it. Our swarm architecture is model-agnostic, so upgrading is seamless. We also continuously optimize our agent prompts and analysis strategies with each new model release — extracting maximum intelligence from every provider. Your scans automatically get smarter over time." },
              { q: "Is your core technology proprietary?", a: "Yes. VerdictSwarm's adversarial consensus engine, prompt architecture, and scoring methodology are proprietary technology. Think of it like PageRank for Google — continuously tuned, continuously upgraded, and central to why our verdict quality compounds over time." },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl border border-[#2D2D3A] bg-[#1A1A28]/50">
                <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-white/80 hover:text-white">{item.q}<span className="text-white/30 transition group-open:rotate-45">+</span></summary>
                <div className="px-4 pb-4 text-sm text-white/50 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-orbitron text-2xl font-bold uppercase md:text-3xl">Ready to audit your next token?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/60">Paste any contract address and get a verdict in seconds. No signup required.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/dapp" className="btn-primary inline-flex h-14 items-center justify-center rounded-xl px-12 text-base font-bold uppercase tracking-wider text-black">Scan Token Now</Link>
            <Link href="/tiers" className="btn-secondary inline-flex h-14 items-center justify-center rounded-xl px-10 text-base font-bold uppercase tracking-wider">View Plans</Link>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/roadmap" className="text-white/40 hover:text-white/60 transition">View Roadmap →</Link>
            <span className="text-white/20">|</span>
            <Link href="/tiers" className="text-[#6B46C1] hover:text-[#7C3AED] transition">View Plans →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
