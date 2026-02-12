import Card from "@/components/ui/Card";

type LockedTierCardProps = {
  tier: string;
  title: string;
  agents: string;
  description: string;
  progressPct?: number; // placeholder for graduation progress
};

export default function LockedTierCard({
  tier,
  title,
  agents,
  description,
  progressPct = 73,
}: LockedTierCardProps) {
  const pct = Math.max(0, Math.min(100, progressPct));

  return (
    <Card className="group relative overflow-hidden p-6 opacity-80 transition hover:opacity-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-vs-purple/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-vs-cyan/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-white/60">{tier}</p>
            <h3 className="mt-2 text-lg font-semibold text-white/90">{title}</h3>
            <p className="mt-1 text-sm text-white/65">{agents}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span aria-hidden>🔒</span>
              Locked
            </span>
          </div>
        </div>

        <div className="mt-4">
          <span className="inline-flex items-center rounded-full border border-vs-border bg-black/30 px-3 py-1 text-xs text-white/75">
            Unlocks at Graduation
          </span>
        </div>

        <p className="mt-4 text-sm text-white/70">{description}</p>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-white/55">
            <span>Graduation progress</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vs-purple to-vs-cyan"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/45">Placeholder — wired to tier gating later.</p>
        </div>
      </div>
    </Card>
  );
}
