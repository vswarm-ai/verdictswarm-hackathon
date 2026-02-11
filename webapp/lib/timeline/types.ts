import type {
  AgentInfo,
  AgentStatus,
  CategoryBreakdown,
  DebateMessage,
  DebateOutcome,
  ScanEventType,
  Severity,
} from "../../types/scan-events";

export type SSEEventType = Extract<
  ScanEventType,
  | "preprocess:start"
  | "preprocess:complete"
  | "scan:start"
  | "scan:consensus"
  | "scan:complete"
  | "scan:error"
  | "agent:start"
  | "agent:thinking"
  | "agent:finding"
  | "agent:score"
  | "agent:complete"
  | "agent:error"
  | "debate:start"
  | "debate:message"
  | "debate:resolved"
  | "verdict:onchain"
>;

export interface RawSSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

export type ActionType =
  | "PHASE_CHANGE"
  | "AGENT_APPEAR"
  | "AGENT_ACTIVATE"
  | "AGENT_THINK"
  | "AGENT_FINDING"
  | "AGENT_SCORE"
  | "AGENT_COMPLETE"
  | "DEBATE_START"
  | "DEBATE_MESSAGE"
  | "DEBATE_RESOLVE"
  | "CONSENSUS_START"
  | "SCORE_REVEAL"
  | "SCAN_COMPLETE"
  | "SCAN_ERROR"
  | "LOG_LINE"
  | "ONCHAIN_TX"
  | "SET_TOKEN";

export interface TimelineAction {
  id: string;
  type: ActionType;
  data: Record<string, unknown>;
  delayMs: number;
  holdMs: number;
}

export type AnimationPhase =
  | "idle"
  | "initializing"
  | "scanning"
  | "debating"
  | "consensus"
  | "complete"
  | "error"
  | "timeout";

export type AgentVisualStatus = Extract<
  AgentStatus | "hidden" | "appearing",
  "waiting" | "active" | "complete" | "error" | "debating" | "locked" | "hidden" | "appearing"
>;

export interface AgentVisualState {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  category: string;
  status: AgentVisualStatus;
  score: number | null;
  scoreRevealed: boolean;
  findings: Array<{ severity: Severity; message: string }>;
  reasoning: string;
}

export interface DebateVisualState {
  active: boolean;
  agentIds: string[];
  topic: string;
  messages: Array<
    Pick<DebateMessage, "from" | "fromName" | "message" | "stance" | "phase"> & {
      round: number;
      targetAgent?: string;
      targetName?: string;
      evidenceCited?: string;
      scoreAdjustment?: {
        agentId: string;
        from: number;
        to: number;
        reason: string;
      };
    }
  >;
  resolved: boolean;
  outcome?: DebateOutcome;
  resolution: string;
  splitPositions?: Array<{
    agentId: string;
    agentName: string;
    position: string;
    score: number;
  }>;
}

export interface TerminalLine {
  id: string;
  timestamp: number;
  message: string;
  type: "system" | "agent" | "finding" | "debate" | "error";
  severity?: Severity;
  agent?: string;
  agentColor?: string;
}

export interface TimelineResult {
  score: number;
  grade: string;
  breakdown: Record<string, CategoryBreakdown>;
  debates: unknown[];
  durationMs: number;
  agentCount: number;
  fullResults?: Record<string, unknown>;
}

export interface TimelineFrame {
  phase: AnimationPhase;
  token: { address: string; chain?: string; name?: string } | null;
  agents: Map<string, AgentVisualState>;
  activeAgentId: string | null;
  terminalLines: TerminalLine[];
  debate: DebateVisualState | null;
  consensusNarrative: string | null;
  finalScore: number | null;
  finalGrade: string | null;
  scoreRevealed: boolean;
  result: TimelineResult | null;
  onchainTx: { txSignature: string; explorerUrl: string; network?: string; verdictPda?: string } | null;
  error: { message: string; code?: string; retryable?: boolean } | null;
  isPlaying: boolean;
  isComplete: boolean;
  progress: number;
  isCached: boolean;
}

export interface TimelineConfig {
  mode: "live" | "cached";
  speedMultiplier: number;
  delays: {
    agentAppear: number;
    agentActivate: number;
    terminalLine: number;
    finding: number;
    agentComplete: number;
    debateMessage: number;
    phaseTransition: number;
    consensusReveal: number;
    scoreCountUp: number;
  };
}

export const LIVE_CONFIG: TimelineConfig = {
  mode: "live",
  speedMultiplier: 1.0,
  delays: {
    agentAppear: 300,
    agentActivate: 200,
    terminalLine: 350,
    finding: 250,
    agentComplete: 400,
    debateMessage: 500,
    phaseTransition: 500,
    consensusReveal: 800,
    scoreCountUp: 1500,
  },
};

export const CACHED_CONFIG: TimelineConfig = {
  mode: "cached",
  speedMultiplier: 0.3,
  delays: {
    agentAppear: 300,
    agentActivate: 200,
    terminalLine: 350,
    finding: 150,
    agentComplete: 300,
    debateMessage: 400,
    phaseTransition: 300,
    consensusReveal: 600,
    scoreCountUp: 1000,
  },
};

export const MAX_TERMINAL_LINES = 50;

export const INITIAL_FRAME: TimelineFrame = {
  phase: "idle",
  token: null,
  agents: new Map<string, AgentVisualState>(),
  activeAgentId: null,
  terminalLines: [],
  debate: null,
  consensusNarrative: null,
  finalScore: null,
  finalGrade: null,
  scoreRevealed: false,
  result: null,
  onchainTx: null,
  error: null,
  isPlaying: false,
  isComplete: false,
  progress: 0,
  isCached: false,
};

export type ScanStartLikePayload = {
  tokenAddress: string;
  chain: string;
  tokenName?: string;
  cached?: boolean;
  agents: AgentInfo[];
};