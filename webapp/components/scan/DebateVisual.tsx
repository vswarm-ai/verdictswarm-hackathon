"use client";

import type { Stance, DebatePhase } from "../../types/scan-events";
import type { DebateVisualState, AgentVisualState } from "../../lib/timeline";

function stanceStyle(stance: Stance): { color: string; label: string; bg: string } {
  switch (stance) {
    case "challenge":
      return { color: "text-red-400", label: "CHALLENGES", bg: "bg-red-500/10 border-red-500/30" };
    case "defend":
      return { color: "text-emerald-400", label: "DEFENDS", bg: "bg-emerald-500/10 border-emerald-500/30" };
    case "concede":
      return { color: "text-gray-400", label: "CONCEDES", bg: "bg-gray-500/10 border-gray-500/30" };
    case "escalate":
      return { color: "text-red-500 font-bold", label: "ESCALATES", bg: "bg-red-600/15 border-red-500/40" };
    case "compromise":
      return { color: "text-yellow-400", label: "COMPROMISES", bg: "bg-yellow-500/10 border-yellow-500/30" };
    default:
      return { color: "text-gray-400", label: "", bg: "bg-gray-500/10 border-gray-500/30" };
  }
}

function phaseLabel(phase?: DebatePhase): string | null {
  switch (phase) {
    case "challenge": return "⚔️ CHALLENGE";
    case "defense": return "🛡️ DEFENSE";
    case "rebuttal": return "🔥 REBUTTAL";
    case "resolution": return "⚖️ RESOLUTION";
    case "consensus": return "🐝 CONSENSUS";
    default: return null;
  }
}

interface DebateVisualProps {
  debate: DebateVisualState;
  agents: Map<string, AgentVisualState>;
}

export function DebateVisual({ debate, agents }: DebateVisualProps) {
  const debatingAgents = debate.agentIds
    .map((id) => agents.get(id))
    .filter(Boolean) as AgentVisualState[];

  return (
    <div className="w-full max-w-2xl mx-auto mt-4">
      {/* Debate Header */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-red-500/50" />
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
          <span className="text-red-400 animate-pulse">⚡</span>
          <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
            {debate.resolved ? "Debate Resolved" : "Disagreement Detected"}
          </span>
          <span className="text-red-400 animate-pulse">⚡</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-red-500/50" />
      </div>

      {/* Topic */}
      <div className="text-center text-sm text-gray-400 mb-3">
        Topic: <span className="text-white font-medium">{debate.topic}</span>
      </div>

      {/* Combatants */}
      <div className="flex items-center justify-center gap-8 mb-4">
        {debatingAgents.map((agent, i) => (
          <div key={agent.id} className="flex flex-col items-center gap-1">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl animate-pulse"
              style={{
                background: `${agent.color}20`,
                boxShadow: `0 0 15px ${agent.color}40`,
              }}
            >
              {agent.icon}
            </div>
            <span className="text-xs font-bold" style={{ color: agent.color }}>
              {agent.displayName}
            </span>
            {i < debatingAgents.length - 1 && (
              <span className="absolute text-2xl text-red-500 animate-bounce">⚡</span>
            )}
          </div>
        ))}
      </div>

      {/* Debate Messages */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {debate.messages.map((msg, i) => {
          const style = stanceStyle(msg.stance);
          const agent = agents.get(msg.from);
          const targetAgent = msg.targetAgent ? agents.get(msg.targetAgent) : null;
          const phase = phaseLabel(msg.phase);
          const isConsensus = msg.phase === "consensus";

          return (
            <div
              key={`${msg.round}-${i}`}
              className={`p-3 rounded-lg border ${
                isConsensus
                  ? "bg-[#00D4AA]/10 border-[#00D4AA]/30"
                  : style.bg
              } transition-all duration-300 animate-fadeIn`}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="flex items-center gap-2 mb-1">
                {isConsensus ? (
                  <span className="text-sm">🐝</span>
                ) : (
                  <span className="text-sm">{agent?.icon}</span>
                )}
                <span className="text-xs font-bold" style={{ color: isConsensus ? "#00D4AA" : agent?.color }}>
                  {msg.fromName}
                </span>
                {targetAgent && !isConsensus && (
                  <>
                    <span className="text-[10px] text-gray-500">→</span>
                    <span className="text-xs" style={{ color: targetAgent.color }}>
                      {targetAgent.displayName}
                    </span>
                  </>
                )}
                {phase && (
                  <span className={`text-[10px] uppercase tracking-wider ${
                    isConsensus ? "text-[#00D4AA]" : style.color
                  }`}>
                    {phase}
                  </span>
                )}
                {!phase && (
                  <span className={`text-[10px] uppercase tracking-wider ${style.color}`}>
                    {style.label}
                  </span>
                )}
                <span className="text-[10px] text-gray-600 ml-auto">Round {msg.round}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{msg.message}</p>
              {msg.evidenceCited && (
                <p className="text-[10px] text-gray-500 mt-1 font-mono">
                  📎 {msg.evidenceCited}
                </p>
              )}
              {msg.scoreAdjustment && (
                <div className="mt-1 text-[10px] text-yellow-400">
                  Score adjusted: {msg.scoreAdjustment.from.toFixed(1)} → {msg.scoreAdjustment.to.toFixed(1)}
                  {" "}({msg.scoreAdjustment.reason})
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolution */}
      {debate.resolved && debate.resolution && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span>⚖️</span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {debate.outcome === "split" ? "Split Verdict" : "Resolution"}
            </span>
          </div>
          <p className="text-sm text-gray-300">{debate.resolution}</p>
          {debate.splitPositions && debate.splitPositions.length > 0 && (
            <div className="mt-2 space-y-1">
              {debate.splitPositions.map((pos) => {
                const agent = agents.get(pos.agentId);
                return (
                  <div key={pos.agentId} className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{agent?.icon}</span>
                    <span style={{ color: agent?.color }}>{pos.agentName}:</span>
                    <span>{pos.score.toFixed(1)}/10 — {pos.position}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
