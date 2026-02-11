"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/cn";

interface ProgressToTierProps {
  currentBalance: number;
  tierThreshold: number;
  tierName: string;
  className?: string;
}

const ProgressToTier: React.FC<ProgressToTierProps> = ({
  currentBalance,
  tierThreshold,
  tierName,
  className,
}) => {
  const percentage = Math.min(Math.round((currentBalance / tierThreshold) * 100), 100);
  const safePct = Number.isFinite(percentage) ? percentage : 0;
  const remaining = Math.max(tierThreshold - currentBalance, 0);

  const motivationalCopy = useMemo(() => {
    if (safePct >= 100) return "Threshold reached! You've unlocked this tier.";
    if (safePct >= 90) return "Almost there! Just a tiny bit more.";
    if (safePct >= 70) return "You're almost there! Investigator status awaits.";
    if (safePct >= 50) return "Halfway point reached. Keep climbing!";
    if (safePct >= 25) return "Making progress! The swarm is watching.";
    return "Start your journey to becoming a top Investigator.";
  }, [safePct]);

  const formattedRemaining = new Intl.NumberFormat().format(remaining);

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white/90">
            {safePct}% to {tierName} Tier
          </p>
          <p className="text-xs text-white/60">
            {remaining > 0 ? (
              <>
                <span className="font-mono text-vs-cyan">{formattedRemaining}</span> more $VSWARM unlocks full swarm
              </>
            ) : (
              "Tier Unlocked"
            )}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-vs-purple animate-pulse">
            {safePct >= 70 && safePct < 100 ? "Near Miss" : ""}
          </span>
        </div>
      </div>

      <div className="relative h-4 w-full overflow-hidden rounded-full border border-white/10 bg-black/40 shadow-inner">
        {/* Glow effect on the filled portion */}
        <div
          className="absolute inset-y-0 left-0 z-10 bg-vs-cyan/20 blur-md transition-[width] duration-1000 ease-out"
          style={{ width: `${safePct}%` }}
        />
        
        {/* The actual progress bar */}
        <div
          className="relative z-20 h-full rounded-full bg-gradient-to-r from-vs-cyan via-vs-purple to-vs-pink transition-[width] duration-1000 ease-out"
          style={{ width: `${safePct}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      <p className="text-xs italic text-white/50 animate-in fade-in slide-in-from-top-1 duration-700">
        "{motivationalCopy}"
      </p>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default ProgressToTier;
