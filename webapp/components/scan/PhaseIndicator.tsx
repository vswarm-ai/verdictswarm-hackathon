"use client";

import type { AnimationPhase } from "../../lib/timeline";

interface PhaseIndicatorProps {
  phase: AnimationPhase;
  completedAgents?: number;
  totalAgents?: number;
  debateRound?: number;
}

const PHASES = [
  { label: "Data", icon: "📡" },
  { label: "Analysis", icon: "🔍" },
  { label: "Debate", icon: "⚡" },
  { label: "Verdict", icon: "⚖️" },
];

export function PhaseIndicator({ phase, completedAgents = 0, totalAgents = 0, debateRound }: PhaseIndicatorProps) {
  const phaseStatus = PHASES.map((_, i) => {
    switch (i) {
      case 0:
        return phase === "idle" || phase === "initializing" ? "active" : "complete";
      case 1:
        if (phase === "idle" || phase === "initializing") return "pending";
        if (phase === "scanning") return "active";
        return "complete";
      case 2:
        if (phase === "debating") return "active";
        if (phase === "consensus" || phase === "complete") return "complete";
        return "pending";
      case 3:
        if (phase === "complete") return "complete";
        if (phase === "consensus") return "active";
        return "pending";
      default:
        return "pending";
    }
  });

  const statusLabel =
    phase === "consensus"
      ? "Reaching consensus..."
      : phase === "debating"
      ? debateRound ? `Debate ${debateRound}` : "Debate in progress"
      : phase === "complete"
      ? "Complete"
      : phase === "scanning" && totalAgents > 0
      ? `Analyzing (${completedAgents}/${totalAgents} agents)`
      : phase === "initializing"
      ? "Identifying token..."
      : phase === "error"
      ? "Scan error"
      : phase === "timeout"
      ? "Scan timeout"
      : "Starting...";

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {PHASES.map((phaseItem, i) => {
        const status = phaseStatus[i];
        return (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              status === "complete"
                ? "bg-[#00D4AA] opacity-80"
                : status === "active"
                ? "bg-[#6B46C1] animate-pulse scale-110"
                : "bg-gray-700"
            }`}
            style={
              status === "active"
                ? {
                    boxShadow:
                      phase === "debating"
                        ? "0 0 8px #FF0055"
                        : phase === "consensus"
                        ? "0 0 8px #00D4AA"
                        : "0 0 8px #6B46C1",
                  }
                : undefined
            }
            title={`${phaseItem.icon} ${phaseItem.label}`}
          />
        );
      })}
      <span className="text-xs text-gray-500 ml-2">{statusLabel}</span>
    </div>
  );
}
