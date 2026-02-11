"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentVisualState, AgentVisualStatus } from "../../lib/timeline";

// --- Agent Icon SVGs (Inline) ---

function TechnicianIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 12 L12 8 L28 8 L32 12 L28 16 L12 16 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="25" cy="12" r="1.5" fill="currentColor"/>
      <path d="M8 24 L12 20 L28 20 L32 24 L28 28 L12 28 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="20" y1="16" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/>
      <text x="15" y="26" fontSize="8" fill="currentColor" fontFamily="monospace">&lt;/&gt;</text>
    </svg>
  );
}

function SecurityIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6 L32 12 L32 22 C32 28 26 34 20 34 C14 34 8 28 8 22 L8 12 Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <rect x="16" y="18" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="20" cy="22" r="1.5" fill="currentColor"/>
      <line x1="20" y1="23.5" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function TokenomicsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="14" r="6" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <line x1="20" y1="11" x2="20" y2="17" stroke="currentColor" strokeWidth="2"/>
      <circle cx="14" cy="26" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="26" cy="26" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M10 30 L14 32 L18 30" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M22 30 L26 32 L30 30" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function SocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="10" cy="28" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="30" cy="28" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="18" y1="15" x2="12" y2="25" stroke="currentColor" strokeWidth="2"/>
      <line x1="22" y1="15" x2="28" y2="25" stroke="currentColor" strokeWidth="2"/>
      <line x1="14" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2"/>
    </svg>
  );
}

function MacroIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <path d="M20 6 L20 34" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 20 L34 20" stroke="currentColor" strokeWidth="1.5"/>
      <ellipse cx="20" cy="20" rx="7" ry="14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M10 12 L30 12" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 28 L30 28" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function DevilsAdvocateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12 L8 8 L8 16 Z" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
      <path d="M28 12 L32 8 L32 16 Z" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
      <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <circle cx="16" cy="18" r="1.5" fill="currentColor"/>
      <circle cx="24" cy="18" r="1.5" fill="currentColor"/>
      <path d="M14 25 Q20 28 26 25" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="20" y1="28" x2="20" y2="32" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function VisionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="20" rx="14" ry="9" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="20" cy="20" r="3" fill="currentColor"/>
      <line x1="6" y1="20" x2="10" y2="20" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="30" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="20" y1="11" x2="20" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1="20" y1="26" x2="20" y2="29" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    </svg>
  );
}

// --- Agent Icon Component Selector ---

function AgentIcon({ agentId, className }: { agentId: string; className?: string }) {
  switch (agentId) {
    case "TechnicianBot": return <TechnicianIcon className={className} />;
    case "SecurityBot": return <SecurityIcon className={className} />;
    case "TokenomicsBot": return <TokenomicsIcon className={className} />;
    case "SocialBot": return <SocialIcon className={className} />;
    case "MacroBot": return <MacroIcon className={className} />;
    case "DevilsAdvocate": return <DevilsAdvocateIcon className={className} />;
    case "VisionBot": return <VisionIcon className={className} />;
    default: return null;
  }
}

// --- All Agent Definitions ---

const ALL_AGENTS = [
  // Scout (FREE) — 2 agents
  { id: "TechnicianBot", name: "TechnicianBot", displayName: "Technician", color: "#00D4FF", tier: "FREE" },
  { id: "SecurityBot", name: "SecurityBot", displayName: "Security", color: "#FF6B6B", tier: "FREE" },
  // Investigator (Tier 1) — +3 agents (5 total)
  { id: "TokenomicsBot", name: "TokenomicsBot", displayName: "Tokenomics", color: "#FFD700", tier: "TIER_1" },
  { id: "SocialBot", name: "SocialBot", displayName: "Social", color: "#6B46C1", tier: "TIER_1" },
  { id: "MacroBot", name: "MacroBot", displayName: "Macro", color: "#00D4AA", tier: "TIER_1" },
  // Prosecutor (Tier 2) — +3 agents (8 total)
  { id: "DevilsAdvocate", name: "DevilsAdvocate", displayName: "Devil's Advocate", color: "#FF0055", tier: "TIER_1" },
  { id: "VisionBot", name: "VisionBot", displayName: "Vision", color: "#FF6B6B", tier: "TIER_2" },
  { id: "WhaleTracker", name: "WhaleTracker", displayName: "Whale Tracker", color: "#00BFFF", tier: "TIER_2" },
  { id: "LiquidityBot", name: "LiquidityBot", displayName: "Liquidity", color: "#20B2AA", tier: "TIER_2" },
  // Grand Jury (Tier 3) — +11 agents (20+ total swarm)
  { id: "MEVDetector", name: "MEVDetector", displayName: "MEV Detector", color: "#FF4500", tier: "TIER_3" },
  { id: "GovernanceBot", name: "GovernanceBot", displayName: "Governance", color: "#9370DB", tier: "TIER_3" },
  { id: "TeamAnalyzer", name: "TeamAnalyzer", displayName: "Team Intel", color: "#4169E1", tier: "TIER_3" },
  { id: "AuditBot", name: "AuditBot", displayName: "Audit", color: "#32CD32", tier: "TIER_3" },
  { id: "NarrativeBot", name: "NarrativeBot", displayName: "Narrative", color: "#DA70D6", tier: "TIER_3" },
  { id: "CrossChainBot", name: "CrossChainBot", displayName: "Cross-Chain", color: "#00CED1", tier: "TIER_3" },
  { id: "RegulationBot", name: "RegulationBot", displayName: "Regulation", color: "#CD853F", tier: "TIER_3" },
  { id: "SentimentBot", name: "SentimentBot", displayName: "Sentiment", color: "#FF69B4", tier: "TIER_3" },
  { id: "InsiderBot", name: "InsiderBot", displayName: "Insider Flow", color: "#FF8C00", tier: "TIER_3" },
  { id: "StressTestBot", name: "StressTestBot", displayName: "Stress Test", color: "#B22222", tier: "TIER_3" },
  { id: "ConsensusBot", name: "ConsensusBot", displayName: "Consensus", color: "#7CFC00", tier: "TIER_3" },
];

// --- Hexagon Cell Component (Framer Motion) ---

interface HexCellProps {
  agent: AgentVisualState | null;
  isDisplayActive: boolean; // from pacing queue activeAgentId
  isDebating: boolean;
  findingsCount: number; // track to trigger flash
  tierLabel?: string; // e.g. "Tier 1", "Tier 2", "Whale"
  }

function HexCell({ agent, isDisplayActive, isDebating, findingsCount, tierLabel }: HexCellProps) {
  const prevFindingsRef = useRef(findingsCount);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  // Flash on new finding
  useEffect(() => {
    if (findingsCount > prevFindingsRef.current && agent) {
      const lastFinding = agent.findings[agent.findings.length - 1];
      const color = lastFinding?.severity === "critical" || lastFinding?.severity === "warning"
        ? "rgba(255,0,85,0.4)"
        : "rgba(0,212,170,0.4)";
      setFlashColor(color);
      const timer = setTimeout(() => setFlashColor(null), 600);
      prevFindingsRef.current = findingsCount;
      return () => clearTimeout(timer);
    }
    prevFindingsRef.current = findingsCount;
  }, [findingsCount, agent]);

  if (!agent) {
    // Empty cell — future expansion slot (visible but dim)
    return (
      <div className="relative" style={{ width: 80, height: 88 }}>
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.4, 0.55, 0.4] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          style={{
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            background: "linear-gradient(135deg, rgba(30,28,45,0.7), rgba(20,18,32,0.7))",
            boxShadow: "inset 0 0 20px rgba(107,70,193,0.08)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            border: "1px solid rgba(107,70,193,0.20)",
          }}
        />
      </div>
    );
  }

  const isLocked = agent.status === "locked";
  const isComplete = agent.status === "complete";

  // Determine visual state: pacing queue activeAgentId overrides agent.status
  const visualState: AgentVisualStatus = isLocked
    ? "locked"
    : isDisplayActive
    ? "active"
    : isDebating
    ? "debating"
    : isComplete
    ? "complete"
    : "waiting";

  const glowColor = isDebating ? "#FF0055" : agent.color;

  // Variant-driven styles
  const getStyles = () => {
    switch (visualState) {
      case "locked":
        return {
          opacity: 0.3,
          scale: 1.0,
          background: "linear-gradient(135deg, rgba(60,60,70,0.7), rgba(40,40,50,0.7))",
          borderColor: "rgba(100,100,110,0.3)",
          borderWidth: "1.5px",
          boxShadow: "none",
          textColor: "#888",
          iconColor: "#888",
        };
      case "active":
        return {
          opacity: 1.0,
          scale: 1.0,
          background: `linear-gradient(135deg, ${agent.color}80, ${agent.color}50)`,
          borderColor: agent.color,
          borderWidth: "3px",
          boxShadow: `0 0 25px ${glowColor}, 0 0 50px ${glowColor}, 0 0 80px ${glowColor}80`,
          textColor: "#fff",
          iconColor: "#fff",
        };
      case "debating":
        return {
          opacity: 1.0,
          scale: 1.0,
          background: `linear-gradient(135deg, #FF005580, #FF005550)`,
          borderColor: "#FF0055",
          borderWidth: "3px",
          boxShadow: `0 0 25px #FF0055, 0 0 50px #FF0055, 0 0 80px #FF005580`,
          textColor: "#fff",
          iconColor: "#fff",
        };
      case "complete":
        return {
          opacity: 0.85,
          scale: 1.0,
          background: `linear-gradient(135deg, ${agent.color}33, rgba(0,212,170,0.15))`,
          borderColor: `${agent.color}80`,
          borderWidth: "2px",
          boxShadow: `0 0 15px rgba(0,212,170,0.3)`,
          textColor: agent.color,
          iconColor: agent.color,
        };
      default: // waiting
        return {
          opacity: 0.5,
          scale: 1.0,
          background: `linear-gradient(135deg, ${agent.color}0D, ${agent.color}08)`,
          borderColor: `${agent.color}4D`,
          borderWidth: "1.5px",
          boxShadow: "none",
          textColor: agent.color,
          iconColor: agent.color,
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="relative" style={{ width: 80, height: 88 }}>
      {/* Scanning ring — only for display-active agents */}
      <AnimatePresence>
        {(isDisplayActive || isDebating) && !isLocked && (
          <motion.svg
            key="scanning-ring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{
              rotate: { repeat: Infinity, duration: 1.5, ease: "linear" },
              opacity: { duration: 0.3 },
            }}
            className="absolute pointer-events-none"
            viewBox="0 0 80 88"
            style={{ width: 88, height: 96, left: -4, top: -4 }}
          >
            <ellipse
              cx="40" cy="44" rx="37" ry="41"
              fill="none"
              stroke={glowColor}
              strokeWidth="2"
              strokeDasharray="20 10"
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Finding flash overlay */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            key={`flash-${findingsCount}`}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              backgroundColor: flashColor,
            }}
          />
        )}
      </AnimatePresence>

      {/* Hexagon shape — animated with Framer Motion */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: styles.opacity,
          scale: visualState === "active" ? [1.0, 1.03, 1.0] : styles.scale,
          boxShadow: visualState === "active"
            ? [
                `0 0 25px ${glowColor}, 0 0 50px ${glowColor}`,
                `0 0 40px ${glowColor}, 0 0 80px ${glowColor}`,
                `0 0 25px ${glowColor}, 0 0 50px ${glowColor}`,
              ]
            : styles.boxShadow,
        }}
        transition={
          visualState === "active"
            ? {
                scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                opacity: { duration: 0.3 },
              }
            : visualState === "complete"
            ? { type: "spring", stiffness: 200, damping: 20 }
            : { duration: 0.5, ease: "easeOut" }
        }
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: styles.background,
          border: `${styles.borderWidth} solid ${styles.borderColor}`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-0.5">
        {isLocked ? (
          <>
            <span className="text-lg text-gray-600 mb-1">🔒</span>
            <span className="text-[10px] text-gray-500 font-bold tracking-wide text-center leading-tight" style={{ color: `${agent.color}60` }}>
              {agent.displayName}
            </span>
            <span className="text-[9px] text-gray-600 uppercase font-mono tracking-tight text-center mt-0.5">
              {tierLabel || "Locked"}
            </span>
          </>
        ) : (
          <>
            <motion.div
              className="w-8 h-8 mb-0.5"
              animate={{ color: styles.iconColor }}
              transition={{ duration: 0.3 }}
              style={{ color: styles.iconColor }}
            >
              <AgentIcon agentId={agent.id} className="w-full h-full" />
            </motion.div>
            <span
              className="text-[10px] font-bold tracking-wide text-center leading-tight"
              style={{ color: styles.textColor }}
            >
              {agent.displayName}
            </span>
            {isComplete && agent.scoreRevealed && agent.score != null && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="text-[8px] text-gray-400 mt-0.5"
              >
                {agent.score.toFixed(1)}
              </motion.span>
            )}
            <AnimatePresence>
              {isComplete && agent.scoreRevealed && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="absolute -top-1 -right-1 text-sm text-green-400"
                >
                  ✓
                </motion.span>
              )}
            </AnimatePresence>
            {isDebating && (
              <span className="absolute -top-1 -right-1 text-xs text-red-500">⚡</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Hexagon Grid Component (Concentric Rings) ---

interface HexagonGridProps {
  agents: Map<string, AgentVisualState>;
  activeAgentId: string | null;
  debateAgentIds?: string[];
  scanTier?: string;
}

export function HexagonGrid({ agents, activeAgentId, debateAgentIds = [], scanTier = "TIER_1" }: HexagonGridProps) {
  const debateSet = new Set(debateAgentIds);

  // Merge backend agents with full agent list
  // Determine which tiers are unlocked based on scan tier
  const tierOrder = ["FREE", "TIER_1", "TIER_2", "TIER_3"];
  const scanTierIndex = tierOrder.indexOf(scanTier);
  const isUnlocked = (agentTier: string) => {
    const tierIndex = tierOrder.indexOf(agentTier);
    return tierIndex !== -1 && tierIndex <= scanTierIndex;
  };

  const agentList: AgentVisualState[] = ALL_AGENTS.map((def) => {
    const tierAllowed = isUnlocked(def.tier);
    const existing = agents.get(def.id);
    if (existing) {
      // Force locked status if tier doesn't allow this agent
      if (!tierAllowed) {
        return { ...existing, status: "locked" as const, score: null, scoreRevealed: false };
      }
      return existing;
    }
    return {
      id: def.id,
      name: def.name,
      displayName: def.displayName,
      icon: "",
      color: def.color,
      phase: 0,
      category: "locked",
      status: "locked" as const,
      score: null,
      scoreRevealed: false,
      reasoning: "",
      findings: [],
    };
  });

  const agentMap = new Map(agentList.map(a => [a.id, a]));

  // Split agents into unlocked vs locked groups
  const unlockedAgents = ALL_AGENTS.filter(a => isUnlocked(a.tier));
  const lockedAgents = ALL_AGENTS.filter(a => !isUnlocked(a.tier));

  // Dynamic radii — pack agents as tight as possible without overlapping
  // Formula: R = cellSize / (2 * sin(π / N)), where N = agent count
  // This gives the minimum circle radius where adjacent hexes just don't touch
  const hexCellSize = 88; // use height (largest dimension)
  const padding = 8;      // small gap between adjacent hexes
  const ringGap = 60;     // space between unlocked and locked rings

  const calcRadius = (count: number) => {
    if (count <= 1) return 0;
    if (count === 2) return hexCellSize / 2 + padding; // special case: opposite sides
    return (hexCellSize + padding) / (2 * Math.sin(Math.PI / count));
  };

  const unlockedRadius = Math.max(calcRadius(unlockedAgents.length), 90); // min 90px so VS emblem has breathing room
  const lockedRadius = unlockedRadius + hexCellSize / 2 + ringGap + calcRadius(lockedAgents.length) > unlockedRadius + hexCellSize + ringGap
    ? unlockedRadius + hexCellSize / 2 + ringGap + (hexCellSize + padding) / (2 * Math.sin(Math.PI / Math.max(lockedAgents.length, 3)))
    : unlockedRadius + hexCellSize + ringGap;

  // Position agents around rings using polar coordinates
  interface AgentPosition {
    agentId: string;
    x: number;
    y: number;
  }

  const positions: AgentPosition[] = [];

  // Position unlocked agents in inner ring
  unlockedAgents.forEach((agent, index) => {
    const angle = (index / unlockedAgents.length) * 2 * Math.PI - Math.PI / 2; // start at top
    const x = unlockedRadius * Math.cos(angle);
    const y = unlockedRadius * Math.sin(angle);
    positions.push({ agentId: agent.id, x, y });
  });

  // Position locked agents in honeycomb clusters on left and right sides
  if (lockedAgents.length > 0) {
    const hexWidth = 80;
    const verticalSpacing = hexCellSize * 0.75; // honeycomb row spacing
    const margin = 20; // margin from container edges and inner ring

    // Estimate container dimensions in pre-scale coordinates
    // The container is full-width (~1200px on desktop) and max-h-[75vh] (~675px)
    // At scale(1.4), pre-scaled coords = actual / 1.4
    // Using generous estimates to ensure clusters fit
    const containerWidth = 800; // ~1120px actual / 1.4
    const containerHeight = 480; // ~675px actual / 1.4

    // Calculate inner ring footprint
    const innerRingLeft = -unlockedRadius - hexCellSize / 2;
    const innerRingRight = unlockedRadius + hexCellSize / 2;
    const innerRingTop = -unlockedRadius - hexCellSize / 2;
    const innerRingBottom = unlockedRadius + hexCellSize / 2;

    // Available space for clusters
    const leftSpaceWidth = containerWidth / 2 + innerRingLeft - margin * 2; // innerRingLeft is negative
    const rightSpaceWidth = containerWidth / 2 - innerRingRight - margin * 2;
    const availableHeight = containerHeight - margin * 2;

    // Balance agent count proportionally by available space
    const totalSpace = leftSpaceWidth + rightSpaceWidth;
    const leftRatio = totalSpace > 0 ? leftSpaceWidth / totalSpace : 0.5;
    const leftCount = Math.max(1, Math.round(lockedAgents.length * leftRatio));
    const leftCluster = lockedAgents.slice(0, leftCount);
    const rightCluster = lockedAgents.slice(leftCount);

    // Helper: arrange agents in a honeycomb cluster
    const arrangeCluster = (
      agents: typeof lockedAgents,
      spaceWidth: number,
      spaceHeight: number,
      centerX: number,
      centerY: number
    ): { agentId: string; x: number; y: number }[] => {
      if (agents.length === 0) return [];

      // Calculate how many columns and rows fit
      const maxCols = Math.max(1, Math.floor(spaceWidth / hexWidth));
      const maxRows = Math.max(1, Math.floor(spaceHeight / verticalSpacing));

      // Distribute agents into grid
      const cols = Math.min(maxCols, Math.ceil(Math.sqrt(agents.length * (hexWidth / verticalSpacing))));
      const rows = Math.ceil(agents.length / cols);

      const clusterPositions: { agentId: string; x: number; y: number }[] = [];
      let agentIdx = 0;

      for (let row = 0; row < rows && agentIdx < agents.length; row++) {
        const rowAgents = Math.min(cols, agents.length - agentIdx);
        const rowWidth = rowAgents * hexWidth - (rowAgents > 1 ? hexWidth * 0.25 : 0); // account for hex offset
        const rowOffset = row % 2 === 1 ? hexWidth / 2 : 0; // honeycomb offset

        for (let col = 0; col < rowAgents && agentIdx < agents.length; col++) {
          const x = centerX + col * hexWidth - rowWidth / 2 + rowOffset;
          const y = centerY + row * verticalSpacing - ((rows - 1) * verticalSpacing) / 2;
          clusterPositions.push({ agentId: agents[agentIdx].id, x, y });
          agentIdx++;
        }
      }

      return clusterPositions;
    };

    // Left cluster: centered between left container edge and left edge of inner ring
    const leftCenterX = (innerRingLeft - containerWidth / 2) / 2;
    const leftCenterY = 0; // vertically centered

    const leftPositions = arrangeCluster(
      leftCluster,
      leftSpaceWidth,
      availableHeight,
      leftCenterX,
      leftCenterY
    );

    // Right cluster: centered between right edge of inner ring and right container edge
    const rightCenterX = (innerRingRight + containerWidth / 2) / 2;
    const rightCenterY = 0; // vertically centered

    const rightPositions = arrangeCluster(
      rightCluster,
      rightSpaceWidth,
      availableHeight,
      rightCenterX,
      rightCenterY
    );

    positions.push(...leftPositions, ...rightPositions);
  }

  // Tier label lookup
  const tierLabels: Record<string, string> = {
    "FREE": "Scout",
    "TIER_1": "Investigator",
    "TIER_2": "Prosecutor",
    "TIER_3": "Grand Jury",
  };
  const agentTierMap = new Map(ALL_AGENTS.map(a => [a.id, a.tier]));

  const unlockedPositions = positions.filter(({ agentId }) => {
    const agent = agentMap.get(agentId);
    return agent && agent.status !== "locked";
  });
  const maxDistance = unlockedPositions.reduce(
    (max, { x, y }) => Math.max(max, Math.hypot(x, y)),
    0
  );
  const svgHalfSize = Math.max(200, Math.ceil(maxDistance + 120));
  const svgSize = svgHalfSize * 2;

  return (
    <div className="relative w-full h-full max-h-[75vh] flex items-center justify-center overflow-hidden">
      {/* HUD Frame */}
      <div
        className="absolute inset-2 pointer-events-none"
        style={{ border: "1px solid rgba(107,70,193,0.3)" }}
      >
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-vs-purple" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-vs-purple" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-vs-purple" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-vs-purple" />
      </div>

      {/* Agent Grid (Concentric Rings) */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) scale(1.4)",
          transformOrigin: "center top",
        }}
      >
        <svg
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width: svgSize,
            height: svgSize,
            transform: "translate(-50%, -50%)",
          }}
          viewBox={`${-svgHalfSize} ${-svgHalfSize} ${svgSize} ${svgSize}`}
          aria-hidden="true"
        >
          <defs>
            <filter id="energy-line-glow" filterUnits="userSpaceOnUse" x={-svgHalfSize} y={-svgHalfSize} width={svgSize} height={svgSize}>
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {unlockedPositions.map(({ agentId, x, y }) => {
            const agent = agentMap.get(agentId);
            if (!agent) return null;
            const isActive = agent.id === activeAgentId;

            return (
              <line
                key={`energy-line-${agentId}`}
                x1={0}
                y1={0}
                x2={x}
                y2={y}
                stroke={agent.color}
                strokeWidth={isActive ? 3 : 1.5}
                opacity={isActive ? 0.9 : 0.3}
                strokeDasharray="8 4"
                strokeLinecap="round"
                filter="url(#energy-line-glow)"
                style={{
                  animation: `energy-flow ${isActive ? 0.7 : 1.1}s linear infinite`,
                }}
              />
            );
          })}
        </svg>

        {positions.map(({ agentId, x, y }) => {
          const agent = agentMap.get(agentId);
          if (!agent) return null;

          const isDisplayActive = agent.id === activeAgentId;
          const isDebating = debateSet.has(agent.id);

          return (
            <div
              key={agentId}
              className="absolute"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <HexCell
                agent={agent}
                isDisplayActive={isDisplayActive}
                isDebating={isDebating}
                findingsCount={agent.findings.length}
                tierLabel={tierLabels[agentTierMap.get(agentId) || ""] || undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Center Emblem */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: 95,
          height: 104,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            background: "linear-gradient(135deg, rgba(107,70,193,0.25), rgba(0,212,170,0.25))",
            border: "2px solid rgba(107,70,193,0.6)",
            boxShadow: "0 0 30px rgba(107,70,193,0.4), 0 0 60px rgba(0,212,170,0.3), inset 0 0 20px rgba(107,70,193,0.2)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            border: "1px solid rgba(107,70,193,0.3)",
            pointerEvents: "none",
          }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-2xl font-bold font-orbitron gradient-text">VS</div>
          <div className="text-[7px] text-gray-500 uppercase tracking-[0.2em] mt-0.5">Swarm</div>
        </div>
      </div>

      {/* Debate lightning */}
      {debateAgentIds.length >= 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
            className="text-5xl text-red-500 drop-shadow-[0_0_15px_rgba(255,0,85,0.9)]"
          >
            ⚡
          </motion.div>
        </div>
      )}

      <style jsx>{`
        @keyframes energy-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
      `}</style>
    </div>
  );
}
