/**
 * VerdictSwarm Scan Event Types
 * 
 * These types define the SSE events that drive the Interrogation Room UI.
 * See docs/STREAMING_ARCHITECTURE.md for the full specification.
 */

// --- Event Types ---

export type ScanEventType =
  | "preprocess:start"
  | "preprocess:complete"
  | "scan:start"
  | "scan:consensus"
  | "scan:complete"
  | "scan:error"
  | "agent:start"
  | "agent:thinking"
  | "agent:finding"
  | "agent:progress"
  | "agent:score"
  | "agent:complete"
  | "agent:error"
  | "debate:start"
  | "debate:message"
  | "debate:resolved"
  | "verdict:onchain";

export type Severity = "critical" | "warning" | "info" | "positive";
export type Stance = "challenge" | "defend" | "concede" | "escalate" | "compromise";
export type DebateOutcome = "consensus" | "compromise" | "split";

// --- Agent UI State ---

export type AgentStatus = "waiting" | "active" | "complete" | "error" | "debating" | "locked";

export interface AgentInfo {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  phase: number;
  category: string;
  status: AgentStatus;
}

export interface Finding {
  severity: Severity;
  message: string;
  evidence?: string;
}

export interface AgentUIState extends AgentInfo {
  score?: number;
  confidence?: number;
  findings: Finding[];
  durationMs?: number;
}

// --- Terminal ---

export type TerminalLineType = "info" | "finding" | "warning" | "error" | "debate" | "system";

export interface TerminalLine {
  timestamp: number;
  agent?: string;
  agentColor?: string;
  message: string;
  type: TerminalLineType;
  severity?: Severity;
}

// --- Debate ---

export type DebatePhase = "challenge" | "defense" | "rebuttal" | "resolution" | "consensus";

export interface DebateMessage {
  from: string;
  fromName: string;
  message: string;
  round: number;
  stance: Stance;
  /** Debate step for frontend animation sequencing */
  phase?: DebatePhase;
  /** Agent being addressed (e.g. who DA is challenging) */
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

/** Structured debate round for results page rendering */
export interface DebateRound {
  phase: DebatePhase;
  agent: string;
  agentName: string;
  target?: string;
  targetName?: string;
  content: string;
  round: number;
  stance: Stance;
}

/** Full debate record included in scan results payload */
export interface DebateRecord {
  topic: string;
  resolution: string;
  outcome?: DebateOutcome;
  rounds?: DebateRound[];
}

export interface DebateUIState {
  agentIds: string[];
  topic: string;
  messages: DebateMessage[];
  resolved: boolean;
  outcome?: DebateOutcome;
  resolution?: string;
  splitPositions?: Array<{
    agentId: string;
    agentName: string;
    position: string;
    score: number;
  }>;
}

// --- Scan Result ---

export interface CategoryBreakdown {
  score: number;
  confidence: number;
  findings?: Finding[];
  summary?: string;
}

export interface VerdictOnchain {
  txSignature: string;
  network: string;
  explorerUrl: string;
  verdictPda?: string;
}

export interface ScanResult {
  score: number;
  grade: string;
  breakdown: Record<string, CategoryBreakdown>;
  debates: DebateRecord[];
  durationMs: number;
  agentCount: number;
  fullResults?: Record<string, unknown>;
  onchainTx?: VerdictOnchain;
}

// --- Interrogation Room State ---

export type IRState =
  | "idle"
  | "connecting"
  | "initializing"
  | "scanning"
  | "debating"
  | "consensus"
  | "complete"
  | "error"
  | "timeout";

export interface InterrogationRoomState {
  state: IRState;
  scanId: string | null;
  token: { address: string; name?: string; chain?: string } | null;
  agents: Map<string, AgentUIState>;
  activeAgentId: string | null;
  currentPhase: number;
  terminalLines: TerminalLine[];
  debate: DebateUIState | null;
  result: ScanResult | null;
  error: { message: string; code: string; retryable: boolean } | null;
}

// --- SSE Event Payloads ---

export interface ScanStartPayload {
  tokenAddress: string;
  chain: string;
  tokenName?: string;
  agentCount: number;
  agents: AgentInfo[];
}

export interface AgentStartPayload {
  agentId: string;
  agentName: string;
  phase: number;
}

export interface AgentThinkingPayload {
  agentId: string;
  agentName: string;
  message: string;
}

export interface AgentFindingPayload {
  agentId: string;
  agentName: string;
  severity: Severity;
  message: string;
  evidence?: string;
}

export interface AgentScorePayload {
  agentId: string;
  agentName: string;
  category: string;
  score: number;
  confidence: number;
}

export interface AgentCompletePayload {
  agentId: string;
  agentName: string;
  durationMs: number;
}

export interface AgentErrorPayload {
  agentId: string;
  agentName: string;
  message: string;
  recoverable: boolean;
}

export interface DebateStartPayload {
  agents: string[];
  topic: string;
  reason: string;
}

export interface DebateMessagePayload extends DebateMessage {}

export interface DebateResolvedPayload {
  outcome: DebateOutcome;
  resolution: string;
  confidence: number;
  adjustedScores?: Record<string, number>;
  splitPositions?: Array<{
    agentId: string;
    agentName: string;
    position: string;
    score: number;
  }>;
}

export interface ScanConsensusPayload {
  score: number;
  grade: string;
  breakdown: Record<string, { score: number; confidence: number }>;
}

export interface ScanCompletePayload {
  score: number;
  grade: string;
  breakdown: Record<string, CategoryBreakdown>;
  debates: DebateRecord[];
  durationMs: number;
  agentCount: number;
  fullResults?: Record<string, unknown>;
}

export interface ScanErrorPayload {
  message: string;
  code: string;
  retryable: boolean;
}
