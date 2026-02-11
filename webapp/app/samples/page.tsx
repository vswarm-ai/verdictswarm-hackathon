"use client";

import { useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

import SampleReportFree from "@/components/SampleReportFree";
import SampleReportTier1 from "@/components/SampleReportTier1";
import SampleReportTier2 from "@/components/SampleReportTier2";
import SampleReportTier3 from "@/components/SampleReportTier3";
import SampleReportConsensus from "@/components/SampleReportConsensus";

const tiers = [
  { id: "free" as const, label: "Free", sub: "Scout" },
  { id: "tier1" as const, label: "Tier 1", sub: "Investigator" },
  { id: "tier2" as const, label: "Tier 2", sub: "Prosecutor" },
  { id: "tier3" as const, label: "Tier 3", sub: "Grand Jury" },
  { id: "consensus" as const, label: "Consensus", sub: "Ultimate" },
];

type TierId = (typeof tiers)[number]["id"];

export default function SamplesPage() {
  const [active, setActive] = useState<TierId>("free");

  const activeIndex = useMemo(() => tiers.findIndex((t) => t.id === active), [active]);

  return (
    <main className="py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs tracking-widest text-white/55">SAMPLE REPORTS</p>
          <h1 className="mt-2 text-3xl font-semibold">See what each tier unlocks</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            The higher your tier, the more bots, stronger cross-checks, and higher confidence you get.
            The Consensus tier adds the debate transcript — the &ldquo;why&rdquo; behind the verdict.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs text-white/55">Unlocked content</div>
          <div className="mt-1 text-sm font-medium">
            {activeIndex + 1}/{tiers.length} tiers
          </div>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap gap-2">
          {tiers.map((t, idx) => {
            const isActive = t.id === active;
            const isUnlocked = idx <= activeIndex;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  "group rounded-xl border px-4 py-3 text-left transition",
                  isActive
                    ? "border-vs-cyan/30 bg-vs-cyan/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={cn("text-sm font-semibold", isActive ? "text-white" : "text-white/85")}>{t.label}</div>
                    <div className="text-xs text-white/55">{t.sub}</div>
                  </div>
                  <div className="text-xs text-white/55">
                    {isUnlocked ? "✓" : "🔒"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-vs-purple to-vs-cyan"
            style={{ width: `${((activeIndex + 1) / tiers.length) * 100}%` }}
          />
        </div>
      </Card>

      <div className="mt-6">
        {active === "free" && <SampleReportFree />}
        {active === "tier1" && <SampleReportTier1 />}
        {active === "tier2" && <SampleReportTier2 />}
        {active === "tier3" && <SampleReportTier3 />}
        {active === "consensus" && <SampleReportConsensus />}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm font-semibold">Why tiers matter</div>
          <p className="mt-2 text-sm text-white/60">
            More tiers unlock more agents and stronger cross-checks, reducing blind spots.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-semibold">Higher confidence</div>
          <p className="mt-2 text-sm text-white/60">
            Flagship models + debate protocol lead to higher confidence and clearer position sizing guidance.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-semibold">Debate transcript = proof</div>
          <p className="mt-2 text-sm text-white/60">
            The Consensus tier shows the reasoning process — disagreements, challenges, and what changed minds.
          </p>
        </Card>
      </div>
    </main>
  );
}
