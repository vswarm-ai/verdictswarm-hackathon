import type {
  AgentVisualState,
  RawSSEEvent,
  TimelineAction,
  TimelineConfig,
  TimelineFrame,
  TimelineResult,
} from "./types";
import { INITIAL_FRAME, MAX_TERMINAL_LINES } from "./types";
import { mapEventToActions } from "./mapper";
import type { DebateMessage } from "../../types/scan-events";

function cloneFrame(frame: TimelineFrame): TimelineFrame {
  return {
    ...frame,
    agents: new Map(frame.agents),
    terminalLines: [...frame.terminalLines],
    debate: frame.debate
      ? {
          ...frame.debate,
          agentIds: [...frame.debate.agentIds],
          messages: [...frame.debate.messages],
          splitPositions: frame.debate.splitPositions ? [...frame.debate.splitPositions] : undefined,
        }
      : null,
    result: frame.result ? { ...frame.result } : null,
    onchainTx: frame.onchainTx ? { ...frame.onchainTx } : null,
    error: frame.error ? { ...frame.error } : null,
  };
}

export class TimelineDirector {
  private config: TimelineConfig;
  private actionQueue: TimelineAction[] = [];
  private frame: TimelineFrame = cloneFrame(INITIAL_FRAME);
  private subscribers = new Set<(frame: TimelineFrame) => void>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private processedActions = 0;
  private totalActions = 0;

  constructor(config: TimelineConfig) {
    this.config = config;
  }

  push(event: RawSSEEvent): void {
    const actions = mapEventToActions(event, this.config);
    if (event.type === "scan:start") {
      const data = event.data as { cached?: boolean };
      this.frame = { ...this.frame, isCached: !!data.cached };
    }
    if (actions.length === 0) return;
    this.actionQueue.push(...actions);
    this.totalActions += actions.length;
    this.frame = { ...this.frame, isPlaying: true };
    this.publish();
    if (!this.isProcessing) this.processNext();
  }

  subscribe(cb: (frame: TimelineFrame) => void): () => void {
    this.subscribers.add(cb);
    cb(cloneFrame(this.frame));
    return () => {
      this.subscribers.delete(cb);
    };
  }

  skipToEnd(): void {
    this.clearTimer();
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift();
      if (!action) break;
      this.applyAction(action);
    }
    this.isProcessing = false;
    this.frame = { ...this.frame, isPlaying: false, progress: 1 };
    this.publish();
  }

  destroy(): void {
    this.clearTimer();
    this.actionQueue = [];
    this.subscribers.clear();
    this.isProcessing = false;
  }

  private processNext(): void {
    if (this.actionQueue.length === 0) {
      this.isProcessing = false;
      this.frame = { ...this.frame, isPlaying: false };
      this.publish();
      return;
    }

    this.isProcessing = true;
    const action = this.actionQueue.shift();
    if (!action) return;

    const effectiveDelay = Math.max(0, action.delayMs * this.config.speedMultiplier);
    this.timeoutId = setTimeout(() => {
      this.applyAction(action);
      this.publish();

      const effectiveHold = Math.max(0, action.holdMs * this.config.speedMultiplier);
      this.timeoutId = setTimeout(() => this.processNext(), effectiveHold);
    }, effectiveDelay);
  }

  private applyAction(action: TimelineAction): void {
    const next = cloneFrame(this.frame);

    switch (action.type) {
      case "PHASE_CHANGE":
        next.phase = action.data.phase as TimelineFrame["phase"];
        break;

      case "AGENT_APPEAR": {
        const id = String(action.data.id);
        const agent: AgentVisualState = {
          id,
          name: String(action.data.name || id),
          displayName: String(action.data.displayName || action.data.name || id),
          icon: String(action.data.icon || ""),
          color: String(action.data.color || "#00D4AA"),
          category: String(action.data.category || ""),
          status: "waiting",
          score: null,
          scoreRevealed: false,
          findings: [],
          reasoning: "",
        };
        next.agents.set(id, agent);
        break;
      }

      case "AGENT_ACTIVATE": {
        const id = String(action.data.agentId);
        const current = next.agents.get(id);
        if (current) {
          next.agents.set(id, { ...current, status: "active" });
        } else {
          // Fallback: create agent from activate data if AGENT_APPEAR was never received
          next.agents.set(id, {
            id,
            name: String(action.data.agentName || action.data.name || id),
            displayName: String(action.data.displayName || action.data.agentName || action.data.name || id),
            icon: String(action.data.icon || ""),
            color: String(action.data.color || "#00D4AA"),
            category: String(action.data.category || ""),
            status: "active",
            score: null,
            scoreRevealed: false,
            findings: [],
            reasoning: "",
          });
        }
        next.activeAgentId = id;
        break;
      }

      case "AGENT_THINK": {
        const id = String(action.data.agentId);
        const current = next.agents.get(id);
        if (current) {
          next.agents.set(id, { ...current, reasoning: String(action.data.message || "") });
        }
        break;
      }

      case "AGENT_FINDING": {
        const id = String(action.data.agentId);
        const current = next.agents.get(id);
        if (current) {
          next.agents.set(id, {
            ...current,
            findings: [
              ...current.findings,
              {
                severity: action.data.severity as AgentVisualState["findings"][number]["severity"],
                message: String(action.data.message || ""),
              },
            ],
          });
        }
        break;
      }

      case "AGENT_SCORE": {
        const id = String(action.data.agentId);
        const current = next.agents.get(id);
        if (current) {
          next.agents.set(id, { ...current, score: Number(action.data.score), scoreRevealed: true });
        }
        break;
      }

      case "AGENT_COMPLETE": {
        const id = String(action.data.agentId);
        const current = next.agents.get(id);
        if (current) {
          const status = action.data.status === "error" ? "error" : "complete";
          next.agents.set(id, { ...current, status });
        }
        if (next.activeAgentId === id) {
          next.activeAgentId = null;
        }
        break;
      }

      case "DEBATE_START": {
        const ids = (action.data.agents as string[]) || [];
        for (const id of ids) {
          const agent = next.agents.get(id);
          if (agent) next.agents.set(id, { ...agent, status: "debating" });
        }
        next.debate = {
          active: true,
          agentIds: ids,
          topic: String(action.data.topic || ""),
          messages: [],
          resolved: false,
          resolution: "",
        };
        break;
      }

      case "DEBATE_MESSAGE": {
        if (!next.debate) break;
        next.debate = {
          ...next.debate,
          messages: [
            ...next.debate.messages,
            {
              from: String(action.data.from || ""),
              fromName: String(action.data.fromName || ""),
              message: String(action.data.message || ""),
              stance: String(action.data.stance || "challenge") as DebateMessage["stance"],
              phase: String(action.data.phase || "challenge") as DebateMessage["phase"],
              round: Number(action.data.round || next.debate.messages.length + 1),
              targetAgent: action.data.targetAgent ? String(action.data.targetAgent) : undefined,
              targetName: action.data.targetName ? String(action.data.targetName) : undefined,
              evidenceCited: action.data.evidenceCited ? String(action.data.evidenceCited) : undefined,
              scoreAdjustment: action.data.scoreAdjustment as
                | { agentId: string; from: number; to: number; reason: string }
                | undefined,
            },
          ],
        };
        const adjustment = action.data.scoreAdjustment as { agentId: string; to: number } | undefined;
        if (adjustment) {
          const adjusted = next.agents.get(adjustment.agentId);
          if (adjusted) next.agents.set(adjustment.agentId, { ...adjusted, score: adjustment.to });
        }
        break;
      }

      case "DEBATE_RESOLVE": {
        if (next.debate) {
          for (const id of next.debate.agentIds) {
            const agent = next.agents.get(id);
            if (agent) next.agents.set(id, { ...agent, status: "complete" });
          }
          const adjusted = (action.data.adjustedScores as Record<string, number> | undefined) || {};
          for (const [id, score] of Object.entries(adjusted)) {
            const agent = next.agents.get(id);
            if (agent) next.agents.set(id, { ...agent, score });
          }
          if (next.debate) {
            next.debate = {
              ...next.debate,
              active: false,
              resolved: true,
              outcome: action.data.outcome as NonNullable<TimelineFrame["debate"]>["outcome"],
              resolution: String(action.data.resolution || ""),
              splitPositions: action.data.splitPositions as NonNullable<TimelineFrame["debate"]>["splitPositions"],
            };
          }
        }
        next.phase = "scanning";
        break;
      }

      case "CONSENSUS_START":
        next.consensusNarrative = `Swarm reaching consensus...`;
        break;

      case "SCORE_REVEAL":
        next.finalScore = Number(action.data.score);
        next.finalGrade = String(action.data.grade);
        next.scoreRevealed = true;
        break;

      case "SCAN_COMPLETE": {
        const d = action.data as Record<string, unknown>;
        const enrichedBreakdown: Record<string, Record<string, unknown>> = {};
        const breakdown = (d.breakdown as Record<string, Record<string, unknown>>) || {};
        for (const [key, cat] of Object.entries(breakdown)) {
          enrichedBreakdown[key] = { ...cat };
        }
        for (const agent of next.agents.values()) {
          const key = agent.category;
          if (!key || !enrichedBreakdown[key] || agent.findings.length === 0) continue;
          const existingFindings = (enrichedBreakdown[key].findings as unknown[]) || [];
          enrichedBreakdown[key].findings = [...existingFindings, ...agent.findings];
        }

        next.phase = "complete";
        next.result = {
          score: Number(d.score),
          grade: String(d.grade),
          breakdown: enrichedBreakdown as unknown as TimelineResult["breakdown"],
          debates: (d.debates as unknown[]) || [],
          durationMs: Number(d.durationMs || 0),
          agentCount: Number(d.agentCount || 0),
          fullResults: d.fullResults as Record<string, unknown> | undefined,
        };
        next.isComplete = true;
        next.activeAgentId = null;
        break;
      }

      case "SCAN_ERROR":
        next.phase = action.data.code === "TIMEOUT" ? "timeout" : "error";
        next.error = {
          message: String(action.data.message || "Unknown scan error"),
          code: action.data.code ? String(action.data.code) : undefined,
          retryable: action.data.retryable as boolean | undefined,
        };
        break;

      case "ONCHAIN_TX":
        next.onchainTx = {
          txSignature: String(action.data.txSignature || ""),
          explorerUrl: String(action.data.explorerUrl || ""),
          network: action.data.network ? String(action.data.network) : undefined,
          verdictPda: action.data.verdictPda ? String(action.data.verdictPda) : undefined,
        };
        if (next.result) {
          next.result = { ...next.result };
        }
        break;

      case "SET_TOKEN":
        next.token = {
          address: String(action.data.address || ""),
          chain: String(action.data.chain || ""),
          name: String(action.data.name || ""),
        };
        break;

      case "LOG_LINE":
        next.terminalLines = [
          ...next.terminalLines,
          {
            id: action.id,
            timestamp: Number(action.data.timestamp || Date.now()),
            message: String(action.data.message || ""),
            type: action.data.type as TimelineFrame["terminalLines"][number]["type"],
            severity: action.data.severity as TimelineFrame["terminalLines"][number]["severity"],
            agent: action.data.agent ? String(action.data.agent) : undefined,
            agentColor: (() => {
              const agentId = action.data.agentId ? String(action.data.agentId) : null;
              const agent = agentId ? next.agents.get(agentId) : undefined;
              return agent?.color;
            })(),
          },
        ];
        if (next.terminalLines.length > MAX_TERMINAL_LINES) {
          next.terminalLines = next.terminalLines.slice(-MAX_TERMINAL_LINES);
        }
        break;
    }

    this.processedActions += 1;
    next.progress = this.totalActions > 0 ? Math.min(1, this.processedActions / this.totalActions) : 0;
    this.frame = next;
  }

  private publish(): void {
    const snapshot = cloneFrame(this.frame);
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private clearTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}