import type { TierKey } from "@/lib/tier";
import { tierByKey } from "@/lib/tier";

export default function TierBadge({ tierKey }: { tierKey: TierKey }) {
  const tier = tierByKey(tierKey);

  const color =
    tierKey === "SWARM_DEBATE"
      ? "border-vs-purple/60 text-vs-purple"
      : tierKey === "TIER_3"
        ? "border-vs-cyan/60 text-vs-cyan"
        : "border-white/20 text-white";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${color}`}
      title={`${tier.name} tier`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {tier.name}
    </span>
  );
}
