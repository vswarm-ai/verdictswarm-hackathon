"use client";

import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";

type Quota = {
  address: string;
  tier: string;
  used: number;
  remaining: number;
  limit: number;
};

export default function QuotaDisplay() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const res = await fetch("/api/quota", { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? "Failed to load quota");
    }
    const data = (await res.json()) as Quota;
    setQuota(data);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, []);

  if (error) return <p className="text-sm text-vs-error">{error}</p>;
  if (!quota) return <p className="text-sm text-white/60">Loading quota…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-white/70">Scans remaining today</p>
          <p className="mt-1 text-2xl font-semibold">
            {quota.remaining} <span className="text-sm text-white/60">/ {quota.limit}</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refresh().catch(() => {})}>
          Refresh
        </Button>
      </div>
      <p className="mt-2 text-xs text-white/60">Used: {quota.used}</p>
    </div>
  );
}
