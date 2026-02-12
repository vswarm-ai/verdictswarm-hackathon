export type TierKey = "FREE" | "TIER_1" | "TIER_2" | "TIER_3" | "SWARM_DEBATE";

export type Tier = {
  /** Backend-compatible tier key. */
  key: TierKey;
  /** User-friendly display name. */
  name: string;
  /** Minimum balance required for tier access. */
  minBalance: number;
  /** Daily scan quota for MVP. */
  dailyScans: number;
  perks: string[];
};

export const TIERS: Tier[] = [
  {
    key: "FREE",
    name: "Scout",
    minBalance: 0,
    dailyScans: 3,
    perks: ["2 AI agents (Technician + Security)", "3 scans/day"],
  },
  {
    key: "TIER_1",
    name: "Investigator",
    minBalance: 50_000,
    dailyScans: 15,
    perks: ["6 agents + Devil's Advocate", "Multi-model debate", "15 scans/day"],
  },
  {
    key: "TIER_2",
    name: "Prosecutor",
    minBalance: 150_000,
    dailyScans: 30,
    perks: ["7 agents + VisionBot", "Multi-round debate", "30 scans/day", "API access"],
  },
  {
    key: "TIER_3",
    name: "Grand Jury",
    minBalance: 500_000,
    dailyScans: 50,
    perks: ["All agents", "Adversarial debates", "50 scans/day", "API + Alerts"],
  },
  {
    key: "SWARM_DEBATE",
    name: "Consensus",
    minBalance: 1_000_000,
    dailyScans: 5,
    perks: ["Full multi-model debate", "4 AI models debate to consensus", "5 debates/day"],
  },
];

export function tierForBalance(balanceTokens: number): Tier {
  // Pick the highest tier whose minBalance <= balance
  return (
    [...TIERS]
      .sort((a, b) => b.minBalance - a.minBalance)
      .find((t) => balanceTokens >= t.minBalance) ?? TIERS[0]
  );
}

export function tierByKey(key: TierKey): Tier {
  const tier = TIERS.find((t) => t.key === key);
  if (!tier) throw new Error(`Unknown tier: ${key}`);
  return tier;
}
