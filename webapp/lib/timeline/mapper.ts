import type {
  AgentCompletePayload,
  AgentErrorPayload,
  AgentFindingPayload,
  AgentScorePayload,
  AgentStartPayload,
  AgentThinkingPayload,
  DebateMessagePayload,
  DebateResolvedPayload,
  DebateStartPayload,
  ScanCompletePayload,
  ScanConsensusPayload,
  ScanErrorPayload,
} from "../../types/scan-events";
import type { RawSSEEvent, TimelineAction, TimelineConfig } from "./types";

let actionCounter = 0;
const nextId = (type: string) => `${type}-${Date.now()}-${actionCounter++}`;

const toRecord = (data: unknown): Record<string, unknown> =>
  (data && typeof data === "object" ? (data as Record<string, unknown>) : {});

export function mapEventToActions(event: RawSSEEvent, config: TimelineConfig): TimelineAction[] {
  switch (event.type) {
    case "preprocess:start":
      return [
        {
          id: nextId("preprocess-start-phase"),
          type: "PHASE_CHANGE",
          data: { phase: "initializing" },
          delayMs: 0,
          holdMs: 0,
        },
        {
          id: nextId("preprocess-start-log"),
          type: "LOG_LINE",
          data: { timestamp: event.timestamp, message: "🔍 Identifying token...", type: "system" },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];

    case "preprocess:complete": {
      const d = toRecord(event.data);
      const name = (d.project_name as string) || (d.token_type as string) || "token";
      const desc = d.project_description ? ` — ${String(d.project_description)}` : "";
      return [
        {
          id: nextId("preprocess-complete-phase"),
          type: "PHASE_CHANGE",
          data: { phase: "scanning" },
          delayMs: 0,
          holdMs: 0,
        },
        {
          id: nextId("preprocess-complete-token"),
          type: "SET_TOKEN",
          data: {
            name,
            address: String((event as RawSSEEvent & { address?: string }).address || d.address || ""),
            chain: String((event as RawSSEEvent & { chain?: string }).chain || d.chain || ""),
          },
          delayMs: 0,
          holdMs: 0,
        },
        {
          id: nextId("preprocess-complete-log"),
          type: "LOG_LINE",
          data: { timestamp: event.timestamp, message: `✓ Identified: ${name}${desc}`, type: "system" },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "scan:start": {
      const d = toRecord(event.data);
      const agents = Array.isArray(d.agents) ? (d.agents as Array<Record<string, unknown>>) : [];
      const actions: TimelineAction[] = [
        {
          id: nextId("scan-start-phase"),
          type: "PHASE_CHANGE",
          data: { phase: "scanning" },
          delayMs: 0,
          holdMs: config.delays.phaseTransition,
        },
        {
          id: nextId("scan-start-token"),
          type: "SET_TOKEN",
          data: {
            name: String(d.tokenName || ""),
            address: String(d.tokenAddress || ""),
            chain: String(d.chain || ""),
          },
          delayMs: 0,
          holdMs: 0,
        },
        {
          id: nextId("scan-start-log"),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: `Scan initiated for ${String(d.tokenName || d.tokenAddress || "token")}`,
            type: "system",
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];

      for (const agent of agents) {
        actions.push({
          id: nextId(`agent-appear-${String(agent.id)}`),
          type: "AGENT_APPEAR",
          data: agent,
          delayMs: config.delays.agentAppear,
          holdMs: 100,
        });
      }
      return actions;
    }

    case "agent:start": {
      const d = event.data as AgentStartPayload;
      return [
        {
          id: nextId(`agent-start-${d.agentId}`),
          type: "AGENT_ACTIVATE",
          data: toRecord(d),
          delayMs: 0,
          holdMs: config.delays.agentActivate,
        },
        {
          id: nextId(`agent-start-log-${d.agentId}`),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: `${d.agentName} entering the interrogation room...`,
            type: "agent",
            agent: d.agentName,
            agentId: d.agentId,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "agent:thinking": {
      const d = event.data as AgentThinkingPayload;
      return [
        {
          id: nextId(`agent-think-${d.agentId}`),
          type: "AGENT_THINK",
          data: toRecord(d),
          delayMs: 0,
          holdMs: 0,
        },
        {
          id: nextId(`agent-think-log-${d.agentId}`),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: d.message,
            type: "agent",
            agent: d.agentName,
            agentId: d.agentId,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "agent:finding": {
      const d = event.data as AgentFindingPayload;
      return [
        {
          id: nextId(`agent-finding-${d.agentId}`),
          type: "AGENT_FINDING",
          data: toRecord(d),
          delayMs: config.delays.finding,
          holdMs: 0,
        },
        {
          id: nextId(`agent-finding-log-${d.agentId}`),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: d.message,
            type: "finding",
            severity: d.severity,
            agent: d.agentName,
            agentId: d.agentId,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "agent:score": {
      const d = event.data as AgentScorePayload;
      return [
        {
          id: nextId(`agent-score-${d.agentId}`),
          type: "AGENT_SCORE",
          data: toRecord(d),
          delayMs: 0,
          holdMs: 0,
        },
      ];
    }

    case "agent:complete": {
      const d = event.data as AgentCompletePayload;
      const durationText = d.durationMs ? ` (${(d.durationMs / 1000).toFixed(1)}s)` : "";
      return [
        {
          id: nextId(`agent-complete-${d.agentId}`),
          type: "AGENT_COMPLETE",
          data: toRecord(d),
          delayMs: 0,
          holdMs: config.delays.agentComplete,
        },
        {
          id: nextId(`agent-complete-log-${d.agentId}`),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: `Analysis complete${durationText}`,
            type: "agent",
            agent: d.agentName,
            agentId: d.agentId,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "agent:error": {
      const d = event.data as AgentErrorPayload;
      return [
        {
          id: nextId(`agent-error-${d.agentId}`),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: d.message,
            type: "error",
            agent: d.agentName,
            agentId: d.agentId,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
        {
          id: nextId(`agent-error-state-${d.agentId}`),
          type: d.recoverable ? "AGENT_ACTIVATE" : "AGENT_COMPLETE",
          data: { ...toRecord(d), status: d.recoverable ? "active" : "error" },
          delayMs: 0,
          holdMs: 0,
        },
      ];
    }

    case "debate:start": {
      const d = event.data as DebateStartPayload;
      return [
        {
          id: nextId("debate-start-phase"),
          type: "PHASE_CHANGE",
          data: { phase: "debating" },
          delayMs: config.delays.phaseTransition,
          holdMs: 0,
        },
        {
          id: nextId("debate-start"),
          type: "DEBATE_START",
          data: toRecord(d),
          delayMs: 0,
          holdMs: 300,
        },
        {
          id: nextId("debate-start-log"),
          type: "LOG_LINE",
          data: { timestamp: event.timestamp, message: `⚡ DISAGREEMENT: ${d.topic}`, type: "debate" },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "debate:message": {
      const d = event.data as DebateMessagePayload;
      return [
        {
          id: nextId("debate-message"),
          type: "DEBATE_MESSAGE",
          data: toRecord(d),
          delayMs: config.delays.debateMessage,
          holdMs: 0,
        },
        {
          id: nextId("debate-message-log"),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: d.message,
            type: "debate",
            agent: d.fromName,
            agentId: d.from,
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "debate:resolved": {
      const d = event.data as DebateResolvedPayload;
      return [
        {
          id: nextId("debate-resolved"),
          type: "DEBATE_RESOLVE",
          data: toRecord(d),
          delayMs: 0,
          holdMs: config.delays.agentComplete,
        },
        {
          id: nextId("debate-resolved-log"),
          type: "LOG_LINE",
          data: { timestamp: event.timestamp, message: `✅ Resolved: ${d.resolution}`, type: "debate" },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "scan:consensus": {
      const d = event.data as ScanConsensusPayload;
      return [
        {
          id: nextId("scan-consensus-phase"),
          type: "PHASE_CHANGE",
          data: { phase: "consensus" },
          delayMs: config.delays.phaseTransition,
          holdMs: 0,
        },
        {
          id: nextId("scan-consensus"),
          type: "CONSENSUS_START",
          data: toRecord(d),
          delayMs: 0,
          holdMs: config.delays.consensusReveal,
        },
        {
          id: nextId("scan-consensus-log"),
          type: "LOG_LINE",
          data: {
            timestamp: event.timestamp,
            message: `🐝 Verdict: ${d.score}/100 (Grade ${d.grade})`,
            type: "system",
          },
          delayMs: 0,
          holdMs: config.delays.terminalLine,
        },
      ];
    }

    case "scan:complete": {
      const d = event.data as ScanCompletePayload;
      return [
        {
          id: nextId("score-reveal"),
          type: "SCORE_REVEAL",
          data: { score: d.score, grade: d.grade },
          delayMs: 0,
          holdMs: config.delays.scoreCountUp,
        },
        {
          id: nextId("scan-complete"),
          type: "SCAN_COMPLETE",
          data: toRecord(d),
          delayMs: 0,
          holdMs: 0,
        },
      ];
    }

    case "scan:error": {
      const d = event.data as ScanErrorPayload;
      return [
        {
          id: nextId("scan-error"),
          type: "SCAN_ERROR",
          data: toRecord(d),
          delayMs: 0,
          holdMs: 0,
        },
      ];
    }

    case "verdict:onchain":
      return [
        {
          id: nextId("onchain"),
          type: "ONCHAIN_TX",
          data: toRecord(event.data),
          delayMs: 0,
          holdMs: 0,
        },
      ];

    default:
      return [];
  }
}