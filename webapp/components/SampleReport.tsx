import Link from "next/link";

import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type SampleTier = "free" | "tier1" | "tier2" | "tier3" | "consensus";

function badgeStyles(tier: SampleTier) {
  switch (tier) {
    case "free":
      return "border-white/10 bg-white/5 text-white/70";
    case "tier1":
      return "border-vs-cyan/25 bg-vs-cyan/10 text-vs-cyan";
    case "tier2":
      return "border-vs-purple/25 bg-vs-purple/10 text-vs-purple";
    case "tier3":
      return "border-vs-purple/35 bg-gradient-to-r from-vs-purple/20 to-vs-cyan/20 text-white";
    case "consensus":
      return "border-vs-purple/45 bg-gradient-to-r from-vs-purple/30 to-vs-cyan/25 text-white";
  }
}

export function TierBadge({ tier, label }: { tier: SampleTier; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        badgeStyles(tier),
      )}
    >
      {label}
    </span>
  );
}

export function LockedBlock({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div className="p-4 blur-[2px]">
        <div className="h-3 w-48 rounded bg-white/10" />
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-11/12 rounded bg-white/10" />
          <div className="h-2 w-9/12 rounded bg-white/10" />
        </div>
      </div>

      <div className="absolute inset-0 grid place-items-center bg-black/50">
        <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-center">
          <div className="text-sm font-semibold">🔒 Locked</div>
          <div className="mt-1 text-xs text-white/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function SampleReportShell({
  tier,
  title,
  subtitle,
  score,
  confidence,
  badge,
  children,
  ctaHref,
  ctaLabel,
}: {
  tier: SampleTier;
  title: string;
  subtitle: string;
  score?: string;
  confidence?: string;
  badge: string;
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6",
        tier === "tier3" && "ring-1 ring-vs-cyan/20",
        tier === "consensus" && "ring-1 ring-vs-purple/30",
      )}
    >
      {(tier === "tier3" || tier === "consensus") && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-60",
            tier === "tier3" && "bg-gradient-to-br from-vs-purple/20 via-transparent to-vs-cyan/15",
            tier === "consensus" && "bg-gradient-to-br from-vs-purple/25 via-black/10 to-vs-cyan/20",
          )}
        />
      )}

      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <TierBadge tier={tier} label={badge} />
            <h2 className="mt-3 text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          </div>

          {(score || confidence) && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              {score && <div className="text-3xl font-semibold">{score}</div>}
              {confidence && <div className="mt-1 text-xs text-white/55">Confidence: {confidence}</div>}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">{children}</div>

        {ctaHref && ctaLabel && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
            <div>
              <div className="text-sm font-semibold">Unlock more bots + higher confidence</div>
              <div className="mt-1 text-xs text-white/55">Upgrade your plan for deeper analysis.</div>
            </div>
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-vs-purple to-vs-cyan px-5 text-sm font-medium text-black shadow-glow hover:opacity-95"
            >
              {ctaLabel} →
            </Link>
          </div>
        )}

        <p className="mt-4 text-xs text-white/45">Sample data. Analysis only. Not financial advice.</p>
      </div>
    </Card>
  );
}

export function MonoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 p-4">
      <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-white/80">
        {children}
      </pre>
    </div>
  );
}
