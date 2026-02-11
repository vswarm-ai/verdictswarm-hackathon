import Card from "@/components/ui/Card";
import Link from "next/link";

export default function IntegratePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          🤖 Connect Your <span className="text-[#6B46C1]">AI Agent</span>
        </h1>
        <div className="inline-block rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 px-4 py-1.5">
          <span className="text-sm font-bold text-[#FFD700]">🚧 Developer API Coming Q2 2026</span>
        </div>
        <p className="text-white/50 max-w-xl mx-auto">
          We&apos;re building a developer API so your AI agent, bot, or automation can access
          VerdictSwarm&apos;s multi-model token analysis programmatically.
        </p>
      </div>

      {/* Why Agents Need VerdictSwarm */}
      <Card className="p-6 border-[#6B46C1]/20 bg-[#6B46C1]/5">
        <h2 className="font-orbitron text-lg font-bold text-[#6B46C1] mb-3">Why Your Agent Needs This</h2>
        <p className="text-sm text-white/60 leading-relaxed mb-4">
          Autonomous agents making token decisions need more than price data. They need
          <strong className="text-white/80"> risk intelligence</strong> — contract audits, social sentiment,
          tokenomics analysis, and adversarial validation. VerdictSwarm provides all of this,
          powered by multiple AI models debating to consensus.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 text-center">
          <div className="rounded-lg bg-[#0A0B0F] p-3">
            <div className="text-2xl">🔒</div>
            <div className="text-xs font-bold text-white/70 mt-1">Pre-Trade Safety</div>
            <p className="text-[10px] text-white/30 mt-1">Check any token before your agent trades</p>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3">
            <div className="text-2xl">📊</div>
            <div className="text-xs font-bold text-white/70 mt-1">Risk Scoring</div>
            <p className="text-[10px] text-white/30 mt-1">0–100 score + grade + category breakdown</p>
          </div>
          <div className="rounded-lg bg-[#0A0B0F] p-3">
            <div className="text-2xl">⚡</div>
            <div className="text-xs font-bold text-white/70 mt-1">Real-Time Streaming</div>
            <p className="text-[10px] text-white/30 mt-1">Agent findings as they happen</p>
          </div>
        </div>
      </Card>

      {/* What's Coming */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-lg font-bold">What&apos;s Coming</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <span className="text-lg">🔑</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">API Key Authentication</h3>
              <p className="text-xs text-white/40 mt-1">Generate keys, track usage, manage rate limits from your dashboard.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <span className="text-lg">📡</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">REST + SSE Endpoints</h3>
              <p className="text-xs text-white/40 mt-1">Synchronous JSON responses or real-time streaming — your choice.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <span className="text-lg">🐾</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">OpenClaw SKILL.md</h3>
              <p className="text-xs text-white/40 mt-1">Drop one file → your OpenClaw agent instantly scans tokens.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <span className="text-lg">🔔</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">Webhook Notifications</h3>
              <p className="text-xs text-white/40 mt-1">Get notified when monitored tokens change risk profile.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Use Cases */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-lg font-bold">Use Cases</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: "🤖", title: "Trading Bots", desc: "Pre-screen tokens before automated trades. Reject anything below Grade C." },
            { icon: "📱", title: "Telegram Bots", desc: "Let users scan tokens directly in chat. '/scan 0x...' → instant verdict." },
            { icon: "🔔", title: "Alert Systems", desc: "Monitor your portfolio. Get notified when a token's risk score changes." },
            { icon: "🏗️", title: "DApp Integration", desc: "Embed risk scores in your DEX, wallet, or launchpad UI." },
            { icon: "🐾", title: "OpenClaw Agents", desc: "Give your AI assistant crypto intelligence with a single skill file." },
            { icon: "📊", title: "Research Tools", desc: "Batch-scan tokens for due diligence reports and portfolio analysis." },
          ].map((uc) => (
            <div key={uc.title} className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
              <div className="flex items-center gap-2 mb-1">
                <span>{uc.icon}</span>
                <h3 className="text-sm font-bold text-white/80">{uc.title}</h3>
              </div>
              <p className="text-xs text-white/40">{uc.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Try the Web App */}
      <Card className="p-6 border-[#00D4AA]/20 bg-[#00D4AA]/5">
        <h2 className="font-orbitron text-lg font-bold text-[#00D4AA] mb-3">Try It Now — On the Web</h2>
        <p className="text-sm text-white/60 mb-4">
          While the developer API is being built, you can experience VerdictSwarm&apos;s full
          analysis on our web app. Same AI agents, same swarm intelligence — just through the browser.
        </p>
        <Link href="/dapp" className="inline-flex items-center gap-2 rounded-lg bg-[#00D4AA] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#00E4BB]">
          Launch a Scan →
        </Link>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4">
        <p className="text-sm text-white/50">
          Want early access to the API?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            DM @VswarmAi for the Waitlist
          </a>
          <Link href="/docs/api" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">
            View Planned API Tiers →
          </Link>
        </div>
      </div>
    </main>
  );
}
