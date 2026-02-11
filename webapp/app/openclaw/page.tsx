import Card from "@/components/ui/Card";
import Link from "next/link";

export default function OpenClawPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="text-6xl">🐾</div>
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          VerdictSwarm × <span className="text-[#00D4AA]">OpenClaw</span>
        </h1>
        <div className="inline-block rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 px-4 py-1.5">
          <span className="text-sm font-bold text-[#FFD700]">🚧 Integration Coming Soon</span>
        </div>
        <p className="text-white/50 max-w-xl mx-auto">
          We&apos;re building a native OpenClaw skill that lets your AI agent
          scan any token for risk — automatically. Drop one file, instant crypto intelligence.
        </p>
      </div>

      {/* Why OpenClaw + VerdictSwarm */}
      <Card className="p-6 border-[#00D4AA]/20 bg-[#00D4AA]/5">
        <h2 className="font-orbitron text-lg font-bold text-[#00D4AA] mb-3">Why This Matters</h2>
        <p className="text-sm text-white/60 leading-relaxed mb-4">
          OpenClaw agents are powerful — but they don&apos;t natively understand crypto risk.
          VerdictSwarm will fill that gap. When the integration launches, your agent will be able to:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: "🔍", text: "Scan any token before recommending or trading it" },
            { icon: "⚖️", text: "Get a 0–100 risk score backed by multiple AI models" },
            { icon: "📊", text: "Stream real-time findings as agents analyze" },
            { icon: "🛡️", text: "Catch rug pulls, honeypots, and suspicious contracts" },
            { icon: "🐝", text: "Leverage swarm intelligence (up to 7 AI agents debating)" },
            { icon: "⚡", text: "React to new tokens in seconds, not hours" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-white/60">
              <span className="shrink-0">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* What Your Agent Will Do */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-lg font-bold">What Your Agent Will Do</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Pre-Trade Safety Check", desc: "Before executing any trade: 'scan this token first'", icon: "🛡️" },
            { title: "Portfolio Monitoring", desc: "Periodically re-scan held tokens for risk changes", icon: "📈" },
            { title: "Research Assistant", desc: "'Analyze this DeFi protocol' → full multi-agent breakdown", icon: "🔬" },
            { title: "Alert System", desc: "Flag tokens that score below threshold automatically", icon: "🔔" },
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

      {/* How It Will Work */}
      <Card className="p-6 border-[#6B46C1]/20">
        <h2 className="font-orbitron text-lg font-bold text-[#6B46C1] mb-3">How It Will Work</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B46C1] text-sm font-bold">1</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">Drop a SKILL.md file</h3>
              <p className="text-xs text-white/50 mt-1">Add one file to your OpenClaw agent&apos;s skills directory.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B46C1] text-sm font-bold">2</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">Agent auto-discovers the skill</h3>
              <p className="text-xs text-white/50 mt-1">Your agent instantly knows how to scan tokens. No code changes.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B46C1] text-sm font-bold">3</span>
            <div>
              <h3 className="text-sm font-bold text-white/80">Ask naturally</h3>
              <p className="text-xs text-white/50 mt-1">&ldquo;Is this token safe?&rdquo; → Your agent scans, analyzes, and reports back.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4">
        <p className="text-sm text-white/50">
          Want to be notified when the OpenClaw integration launches?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#00D4AA] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#00E4BB]"
          >
            Follow @VswarmAi for Updates
          </a>
          <Link href="/dapp" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">
            Try the Web App Now →
          </Link>
        </div>
        <p className="text-xs text-white/30 italic">&ldquo;The smartest agents don&apos;t trade blind.&rdquo;</p>
      </div>
    </main>
  );
}
