"use client";

/**
 * Interrogation Room State Machine
 *
 * Drives the real-time agent monitoring UI via a reducer that processes
 * SSE events. Pure state transitions — no side effects in the reducer.
 *
 * See docs/STREAMING_ARCHITECTURE.md Layer 5.
 */

import { useReducer, useEffect, useCallback, useRef } from "react";
import type {
  InterrogationRoomState,
  AgentUIState,
  TerminalLine,
  ScanEventType,
  IRState,
  ScanStartPayload,
  AgentStartPayload,
  AgentThinkingPayload,
  AgentFindingPayload,
  AgentScorePayload,
  AgentCompletePayload,
  AgentErrorPayload,
  DebateStartPayload,
  DebateMessagePayload,
  DebateResolvedPayload,
  ScanConsensusPayload,
  ScanCompletePayload,
  ScanErrorPayload,
  CategoryBreakdown,
} from "../types/scan-events";

// --- Constants ---

const MAX_TERMINAL_LINES = 50; // keep last 50 lines in memory
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

// --- Initial State ---

const initialState: InterrogationRoomState = {
  state: "idle",
  scanId: null,
  token: null,
  agents: new Map(),
  activeAgentId: null,
  currentPhase: 0,
  terminalLines: [],
  debate: null,
  debateCount: 0,
  result: null,
  error: null,
};

// --- Action (an SSE event routed to the reducer) ---

interface ReducerAction {
  type: ScanEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// --- Helpers ---

function updateAgent(
  agents: Map<string, AgentUIState>,
  agentId: string,
  patch: Partial<AgentUIState>,
): Map<string, AgentUIState> {
  const next = new Map(agents);
  const existing = next.get(agentId);
  if (existing) {
    next.set(agentId, { ...existing, ...patch });
  }
  return next;
}

function addTerminalLine(
  lines: TerminalLine[],
  line: TerminalLine,
): TerminalLine[] {
  const next = [...lines, line];
  return next.length > MAX_TERMINAL_LINES ? next.slice(-MAX_TERMINAL_LINES) : next;
}

function getAgentColor(agents: Map<string, AgentUIState>, agentId: string): string | undefined {
  return agents.get(agentId)?.color;
}

// --- Reducer ---

function reducer(state: InterrogationRoomState, action: ReducerAction): InterrogationRoomState {
  const { type, data, timestamp } = action;

  switch (type) {
    case "preprocess:start": {
      return {
        ...state,
        state: "initializing",
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: "🔍 Identifying token...",
          type: "system",
        }),
      };
    }

    case "preprocess:complete": {
      const d = data as Record<string, unknown>;
      const name = d.project_name || d.token_type || "token";
      const desc = d.project_description ? ` — ${d.project_description}` : "";
      return {
        ...state,
        state: state.state === "initializing" ? "scanning" : state.state,
        token: {
          ...state.token,
          address: state.token?.address || "",
          name: String(name),
          chain: state.token?.chain,
        },
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: `✓ Identified: ${name}${desc}`,
          type: "system",
        }),
      };
    }

    case "scan:start": {
      const d = data as unknown as ScanStartPayload;
      const agents = new Map<string, AgentUIState>();
      for (const a of d.agents) {
        agents.set(a.id, { ...a, findings: [] });
      }
      return {
        ...state,
        state: "scanning",
        scanId: state.scanId,
        token: { address: d.tokenAddress, chain: d.chain, name: d.tokenName },
        agents,
        currentPhase: 0,
        activeAgentId: null,
        debate: null,
        result: null,
        error: null,
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: `Scan initiated for ${d.tokenName || d.tokenAddress}`,
          type: "system",
        }),
      };
    }

    case "agent:start": {
      const d = data as unknown as AgentStartPayload;
      return {
        ...state,
        activeAgentId: d.agentId,
        currentPhase: d.phase,
        agents: updateAgent(state.agents, d.agentId, { status: "active" }),
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.agentName,
          agentColor: getAgentColor(state.agents, d.agentId),
          message: `${d.agentName} entering the interrogation room...`,
          type: "system",
        }),
      };
    }

    case "agent:thinking": {
      const d = data as unknown as AgentThinkingPayload;
      return {
        ...state,
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.agentName,
          agentColor: getAgentColor(state.agents, d.agentId),
          message: d.message,
          type: "info",
        }),
      };
    }

    case "agent:finding": {
      const d = data as unknown as AgentFindingPayload;
      const existingAgent = state.agents.get(d.agentId);
      const findings = [
        ...(existingAgent?.findings || []),
        { severity: d.severity, message: d.message, evidence: d.evidence },
      ];
      return {
        ...state,
        agents: updateAgent(state.agents, d.agentId, { findings }),
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.agentName,
          agentColor: getAgentColor(state.agents, d.agentId),
          message: d.message,
          type: "finding",
          severity: d.severity,
        }),
      };
    }

    case "agent:score": {
      const d = data as unknown as AgentScorePayload;
      return {
        ...state,
        agents: updateAgent(state.agents, d.agentId, {
          score: d.score,
          confidence: d.confidence,
        }),
      };
    }

    case "agent:complete": {
      const d = data as unknown as AgentCompletePayload;
      return {
        ...state,
        agents: updateAgent(state.agents, d.agentId, {
          status: "complete",
          durationMs: d.durationMs,
        }),
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.agentName,
          agentColor: getAgentColor(state.agents, d.agentId),
          message: `Analysis complete${d.durationMs ? ` (${(d.durationMs / 1000).toFixed(1)}s)` : ""}`,
          type: "system",
        }),
      };
    }

    case "agent:error": {
      const d = data as unknown as AgentErrorPayload;
      return {
        ...state,
        agents: updateAgent(state.agents, d.agentId, {
          status: d.recoverable ? "active" : "error",
        }),
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.agentName,
          agentColor: getAgentColor(state.agents, d.agentId),
          message: d.message,
          type: d.recoverable ? "warning" : "error",
        }),
      };
    }

    case "debate:start": {
      const d = data as unknown as DebateStartPayload;
      const agentsInDebate = new Map(state.agents);
      for (const id of d.agents) {
        const a = agentsInDebate.get(id);
        if (a) agentsInDebate.set(id, { ...a, status: "debating" });
      }
      return {
        ...state,
        state: "debating",
        agents: agentsInDebate,
        debateCount: state.debateCount + 1,
        debate: {
          agentIds: d.agents,
          topic: d.topic,
          messages: [],
          resolved: false,
        },
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: `⚡ DISAGREEMENT: ${d.topic}`,
          type: "debate",
        }),
      };
    }

    case "debate:message": {
      const d = data as unknown as DebateMessagePayload;
      if (!state.debate) return state;

      // Apply score adjustment if present
      let agents = state.agents;
      if (d.scoreAdjustment) {
        agents = updateAgent(agents, d.scoreAdjustment.agentId, {
          score: d.scoreAdjustment.to,
        });
      }

      return {
        ...state,
        agents,
        debate: {
          ...state.debate,
          messages: [...state.debate.messages, d],
        },
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          agent: d.fromName,
          agentColor: getAgentColor(state.agents, d.from),
          message: d.message,
          type: "debate",
        }),
      };
    }

    case "debate:resolved": {
      const d = data as unknown as DebateResolvedPayload;
      // Restore debating agents to complete status
      const agents = new Map(state.agents);
      if (state.debate) {
        for (const id of state.debate.agentIds) {
          const a = agents.get(id);
          if (a) agents.set(id, { ...a, status: "complete" });
        }
      }
      // Apply adjusted scores
      if (d.adjustedScores) {
        for (const [id, score] of Object.entries(d.adjustedScores)) {
          const a = agents.get(id);
          if (a) agents.set(id, { ...a, score });
        }
      }
      return {
        ...state,
        state: "scanning",
        agents,
        debate: state.debate
          ? {
              ...state.debate,
              resolved: true,
              outcome: d.outcome,
              resolution: d.resolution,
              splitPositions: d.splitPositions,
            }
          : null,
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: `✅ Resolved: ${d.resolution}`,
          type: "debate",
        }),
      };
    }

    case "scan:consensus": {
      const d = data as unknown as ScanConsensusPayload;
      return {
        ...state,
        state: "consensus",
        terminalLines: addTerminalLine(state.terminalLines, {
          timestamp,
          message: `🐝 Verdict: ${d.score}/100 (Grade ${d.grade})`,
          type: "system",
        }),
      };
    }

    case "scan:complete": {
      const d = data as unknown as ScanCompletePayload;
      // Enrich breakdown categories with findings collected from agent:finding events
      const enrichedBreakdown: Record<string, CategoryBreakdown> = {};
      for (const [key, cat] of Object.entries(d.breakdown || {})) {
        enrichedBreakdown[key] = { ...cat };
      }
      // Map agent findings into their category's breakdown entry
      for (const agent of state.agents.values()) {
        const catKey = agent.category;
        if (catKey && enrichedBreakdown[catKey] && agent.findings.length > 0) {
          enrichedBreakdown[catKey] = {
            ...enrichedBreakdown[catKey],
            findings: [
              ...(enrichedBreakdown[catKey].findings || []),
              ...agent.findings,
            ],
          };
        }
      }
      return {
        ...state,
        state: "complete",
        result: {
          score: d.score,
          grade: d.grade,
          breakdown: enrichedBreakdown,
          debates: d.debates,
          durationMs: d.durationMs,
          agentCount: d.agentCount,
          fullResults: d.fullResults,
        },
      };
    }

    case "scan:error": {
      const d = data as unknown as ScanErrorPayload;
      return {
        ...state,
        state: d.code === "TIMEOUT" ? "timeout" : "error",
        error: { message: d.message, code: d.code, retryable: d.retryable },
      };
    }

    case "verdict:onchain": {
      // Arrives after scan:complete — patch the result with on-chain tx info
      if (!state.result) return state;
      return {
        ...state,
        result: {
          ...state.result,
          onchainTx: data as unknown as { txSignature: string; network: string; explorerUrl: string; verdictPda?: string },
        },
      };
    }

    default:
      return state;
  }
}

// --- Legacy Event Adapter ---
// Maps old-style events (bot_start, bot_complete, verdict) to new typed events
// so the Interrogation Room works with the existing backend while we upgrade it.

function adaptLegacyEvent(
  eventType: string,
  data: Record<string, unknown>,
): ReducerAction | null {
  const timestamp = Date.now();

  switch (eventType) {
    case "start": {
      const bots = (data.bots as Array<{ bot: string; emoji: string; status: string }>) || [];
      const agents = bots.map((b, i) => ({
        id: b.bot.toLowerCase().replace(/\s+/g, "-"),
        name: b.bot,
        displayName: b.bot.replace("Bot", ""),
        icon: b.emoji,
        color: getDefaultColor(b.bot),
        phase: i + 1,
        category: getCategoryForBot(b.bot),
        status: b.status as "waiting" | "locked",
      }));
      return {
        type: "scan:start",
        data: {
          tokenAddress: data.address as string,
          chain: data.chain as string,
          agentCount: agents.length,
          agents,
        },
        timestamp,
      };
    }

    case "bot_start": {
      const botName = data.bot as string;
      return {
        type: "agent:start",
        data: {
          agentId: botName.toLowerCase().replace(/\s+/g, "-"),
          agentName: botName,
          phase: 1,
        },
        timestamp,
      };
    }

    case "bot_complete": {
      const botName = data.bot as string;
      const agentId = botName.toLowerCase().replace(/\s+/g, "-");
      return {
        type: "agent:complete",
        data: {
          agentId,
          agentName: botName,
          durationMs: 0,
        },
        timestamp,
      };
    }

    case "bot_error": {
      const botName = data.bot as string;
      return {
        type: "agent:error",
        data: {
          agentId: botName.toLowerCase().replace(/\s+/g, "-"),
          agentName: botName,
          message: data.error as string || "Unknown error",
          recoverable: false,
        },
        timestamp,
      };
    }

    case "bot_locked": {
      // No direct mapping — could show locked state
      return null;
    }

    case "verdict": {
      const score = data.score as number | null;
      if (score == null || data.error) {
        return {
          type: "scan:error",
          data: {
            message: (data.error as string) || "Scan failed",
            code: "API_ERROR",
            retryable: true,
          },
          timestamp,
        };
      }
      return {
        type: "scan:complete",
        data: {
          score: score * 10, // convert 0-10 to 0-100
          grade: scoreToGrade(score * 10),
          breakdown: data.analysis || data.bots || {},
          debates: [],
          durationMs: 0,
          agentCount: Object.keys(data.bots || {}).length,
          fullResults: data,
        },
        timestamp,
      };
    }

    default:
      return null;
  }
}

// --- Utility Functions ---

function getDefaultColor(botName: string): string {
  const colors: Record<string, string> = {
    TechnicianBot: "#00D4FF",
    SecurityBot: "#00D4AA",
    TokenomicsBot: "#FFD700",
    SocialBot: "#6B46C1",
    MacroBot: "#FF6B6B",
    DevilsAdvocate: "#FF0055",
    VisionBot: "#FF6B6B",
  };
  return colors[botName] || "#6B46C1";
}

function getCategoryForBot(botName: string): string {
  const categories: Record<string, string> = {
    TechnicianBot: "security",
    SecurityBot: "security",
    TokenomicsBot: "utility",
    SocialBot: "social",
    MacroBot: "utility",
    DevilsAdvocate: "meta",
    VisionBot: "security",
  };
  return categories[botName] || "utility";
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "A-";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

// --- Hook ---

export function useInterrogationRoom(scanId: string | null, streamUrl?: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startScan = useCallback((address: string, chain = "base", tier = "FREE", fresh = false) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Connect directly to backend SSE endpoint (bypasses Vercel proxy auth wall)
    const anonWallet = `anonymous-${Math.random().toString(36).slice(2, 10)}`;
    const url =
      streamUrl ||
      `${BACKEND_URL}/api/scan/stream?address=${encodeURIComponent(address)}&chain=${chain}&tier=${tier}&wallet=${anonWallet}${fresh ? "&fresh=true" : ""}`;

    const source = new EventSource(url);
    eventSourceRef.current = source;

    // New typed events
    const newEventTypes: ScanEventType[] = [
      "preprocess:start", "preprocess:complete",
      "scan:start", "scan:consensus", "scan:complete", "scan:error",
      "agent:start", "agent:thinking", "agent:finding", "agent:score",
      "agent:complete", "agent:error",
      "debate:start", "debate:message", "debate:resolved",
      "verdict:onchain",
    ];

    for (const eventType of newEventTypes) {
      source.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: eventType, data, timestamp: Date.now() });
        } catch {
          // ignore parse errors
        }
      });
    }

    // Legacy event support (backwards compatible with current backend)
    const legacyEventTypes = ["start", "bot_start", "bot_complete", "bot_error", "bot_locked", "verdict"];
    for (const eventType of legacyEventTypes) {
      source.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const adapted = adaptLegacyEvent(eventType, data);
          if (adapted) {
            dispatch(adapted);
          }
        } catch {
          // ignore parse errors
        }
      });
    }

    source.onerror = () => {
      // Only dispatch error if we haven't already completed successfully.
      // The server closes the SSE connection after scan:complete which
      // triggers onerror — that's normal, not an error.
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        eventSourceRef.current = null;
      }
    };
  }, [streamUrl]);

  // Close EventSource when scan completes or errors (prevents dangling connections)
  useEffect(() => {
    if (state.state === "complete" || state.state === "error" || state.state === "timeout") {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [state.state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startScan,
    isScanning: state.state === "scanning" || state.state === "debating" || state.state === "consensus",
    isComplete: state.state === "complete",
    isError: state.state === "error" || state.state === "timeout",
  };
}

export { scoreToGrade, getDefaultColor };
