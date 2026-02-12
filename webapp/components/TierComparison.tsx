import Card from "@/components/ui/Card";

type FeatureRow = {
  feature: string;
  free: React.ReactNode;
  tier1: React.ReactNode;
};

const rows: FeatureRow[] = [
  { feature: "Basic Scan", free: "✅", tier1: "✅" },
  { feature: "HEALTHY/UNHEALTHY", free: "✅", tier1: "✅" },
  { feature: "AI Agent Analysis", free: "❌", tier1: "✅ (3 agents)" },
  { feature: "Detailed Report", free: "❌", tier1: "✅" },
  { feature: "SwarmScore™", free: "❌", tier1: "✅" },
];

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-white/80">{children}</div>;
}

export default function TierComparison() {
  return (
    <section className="mt-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest text-white/60">TIERS</p>
          <h2 className="text-2xl font-semibold">Choose your verdict power</h2>
          <p className="max-w-2xl text-sm text-white/70">
            Start free. Upgrade to Pro for full 6-agent adversarial analysis.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">FREE</p>
                  <p className="mt-1 text-xs text-white/60">Instant signal. Zero friction.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  $0
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {rows.map((r) => (
                  <div key={r.feature} className="flex items-center justify-between gap-4">
                    <div className="text-sm text-white/65">{r.feature}</div>
                    <Cell>{r.free}</Cell>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-vs-purple/25 via-transparent to-vs-cyan/15" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-vs-purple/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-vs-cyan/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">TIER 1</p>
                  <p className="mt-1 text-xs text-white/60">3-agent swarm + detailed report.</p>
                </div>
                <span className="rounded-full border border-vs-border bg-black/30 px-3 py-1 text-xs text-white/80">
                  Connect Wallet
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {rows.map((r) => (
                  <div key={r.feature} className="flex items-center justify-between gap-4">
                    <div className="text-sm text-white/65">{r.feature}</div>
                    <Cell>{r.tier1}</Cell>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-vs-border bg-black/25 p-4">
                <p className="text-xs text-white/60">Pro tip</p>
                <p className="mt-1 text-sm text-white/75">
                  Tier 1 is designed for traders who want explainable agent reasoning — not just a
                  green/red label.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
