"use client";

import { useState } from "react";
import type { TierKey } from "@/lib/tier";

import TierBadge from "@/components/TierBadge";
import QuotaDisplay from "@/components/QuotaDisplay";
import ScanForm from "@/components/ScanForm";
import ScanResults from "@/components/ScanResults";
import ConnectButton from "@/components/ConnectButton";
import Card from "@/components/ui/Card";
import ProgressToTier from "@/components/ProgressToTier";

export default function ScanDashboard({
  user,
}: {
  user: {
    address: `0x${string}`;
    tierKey: TierKey;
    vswarmBalance: number;
  };
}) {
  const [result, setResult] = useState<any | null>(null);
  const [quotaKey, setQuotaKey] = useState(0);

  return (
    <div className="mx-auto w-full max-w-6xl py-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs tracking-widest text-white/55">PRIVATE DASHBOARD</p>
          <h1 className="mt-2 text-2xl font-semibold">Your Scans</h1>
          <p className="mt-1 text-sm text-white/60">
            Connected wallet: <span className="font-mono text-white/80">{user.address}</span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            <TierBadge tierKey={user.tierKey} />
            <span className="text-xs text-white/55">
              $VSWARM (Base): {user.vswarmBalance.toLocaleString()}
            </span>
          </div>

          {user.tierKey === "FREE" && (
            <div className="mt-4 max-w-sm">
              <ProgressToTier
                currentBalance={user.vswarmBalance}
                tierThreshold={50000}
                tierName="Investigator"
              />
            </div>
          )}
        </div>

        <div className="min-w-[280px]">
          <ConnectButton />
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="p-4" key={quotaKey}>
            <QuotaDisplay />
          </Card>
        </div>
        <div className="md:col-span-2">
          <ScanForm
            onResult={(r) => setResult(r)}
            onQuotaUpdate={() => setQuotaKey((k) => k + 1)}
          />
        </div>
      </div>

      <div className="mt-6">
        <ScanResults result={result} />
      </div>
    </div>
  );
}
