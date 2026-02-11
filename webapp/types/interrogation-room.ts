/**
 * Interrogation Room State Types
 *
 * Re-exports from scan-events.ts for convenience.
 * The canonical types live in scan-events.ts to avoid duplication.
 */

export type {
  IRState,
  InterrogationRoomState,
  AgentUIState,
  AgentStatus,
  AgentInfo,
  TerminalLine,
  TerminalLineType,
  DebateUIState,
  DebateMessage,
  ScanResult,
  CategoryBreakdown,
  Finding,
  Severity,
  Stance,
  DebateOutcome,
} from "./scan-events";
