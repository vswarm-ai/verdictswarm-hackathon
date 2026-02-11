import Card from "@/components/ui/Card";
import Link from "next/link";

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="text-6xl">⚡</div>
        <h1 className="font-orbitron text-3xl font-bold md:text-4xl">
          Developer <span className="text-[#6B46C1]">API</span>
        </h1>
        <div className="inline-block rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 px-4 py-1.5">
          <span className="text-sm font-bold text-[#FFD700]">🚧 Coming Q2 2026</span>
        </div>
        <p className="text-white/50 max-w-xl mx-auto">
          Programmatic access to VerdictSwarm&apos;s multi-model token analysis.
          Built for trading bots, portfolio tools, and AI agents.
        </p>
      </div>

      {/* Planned Tiers */}
      <Card className="p-6 space-y-4">
        <h2 className="font-orbitron text-lg font-bold">Planned API Tiers</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <h3 className="text-sm font-bold text-[#00D4AA]">Developer</h3>
            <p className="text-xs text-white/40 mt-1">Free — 500 requests/month</p>
            <p className="text-xs text-white/30 mt-2">Perfect for prototyping and personal projects.</p>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <h3 className="text-sm font-bold text-[#6B46C1]">Startup</h3>
            <p className="text-xs text-white/40 mt-1">$299/mo — 3,000 requests/month</p>
            <p className="text-xs text-white/30 mt-2">For bots and tools with real users.</p>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <h3 className="text-sm font-bold text-[#FFD700]">Growth</h3>
            <p className="text-xs text-white/40 mt-1">$1,499/mo — 30,000 requests/month</p>
            <p className="text-xs text-white/30 mt-2">High-volume integrations and platforms.</p>
          </div>
          <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
            <h3 className="text-sm font-bold text-white/70">Enterprise</h3>
            <p className="text-xs text-white/40 mt-1">Custom pricing</p>
            <p className="text-xs text-white/30 mt-2">White-label, custom models, SLA guarantees.</p>
          </div>
        </div>
      </Card>

      {/* What You'll Get */}
      <Card className="p-6 space-y-3">
        <h2 className="font-orbitron text-lg font-bold">What the API Will Offer</h2>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> Full token risk analysis (same quality as web app)</li>
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> Real-time SSE streaming of agent findings</li>
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> JSON response with score, grade, findings, evidence</li>
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> Multi-chain support (Ethereum, Solana, Base, Arbitrum, more)</li>
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> API key dashboard with usage analytics</li>
          <li className="flex items-start gap-2"><span className="text-[#00D4AA]">✓</span> Webhook notifications for monitored tokens</li>
        </ul>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4">
        <p className="text-sm text-white/50">
          Want early access? Join the waitlist.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            DM @VswarmAi for Early Access
          </a>
          <Link href="/dapp" className="inline-flex items-center gap-2 rounded-xl border border-[#2D2D3A] px-6 py-3 text-sm text-white/60 transition hover:bg-white/5">
            Try the Web App Now →
          </Link>
        </div>
      </div>
    </main>
  );
}
