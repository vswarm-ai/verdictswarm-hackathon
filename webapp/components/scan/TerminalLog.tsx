"use client";

import { useRef, useEffect } from "react";
import type { Severity } from "../../types/scan-events";
import type { TerminalLine } from "../../lib/timeline";

function severityColor(severity?: Severity): string {
  switch (severity) {
    case "critical": return "text-red-500";
        case "positive": return "text-emerald-400";
    case "info":
    default: return "text-green-400";
  }
}

function lineTypePrefix(type: TerminalLine["type"]): string {
  switch (type) {
    case "debate": return "⚡";
    case "finding": return "►";
        case "error": return "✖";
    case "system": return "●";
    default: return ">";
  }
}

function lineColor(line: TerminalLine): string {
  // Challenge/debate lines get special styling based on emoji prefix
  if (line.message?.startsWith("⚔️")) return "text-red-400";
  if (line.message?.startsWith("🤔")) return "text-yellow-400";
  if (line.message?.startsWith("✅")) return "text-emerald-400";

  switch (line.type) {
    case "debate": return "text-red-400";
    case "error": return "text-red-500";
        case "finding": return severityColor(line.severity);
    case "system": return "text-cyan-400";
    default: return "text-green-400";
  }
}

export function TerminalLog({ lines }: { lines: TerminalLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleLines = lines; // show all lines, container scrolls

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full mx-auto rounded-lg border border-[#2D2D3A] bg-black/80 backdrop-blur-sm p-4 font-mono text-sm overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2D2D3A]">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-gray-500 ml-2">SWARM TERMINAL</span>
      </div>
      <div className="space-y-1">
        {visibleLines.length === 0 && (
          <div className="text-gray-600 animate-pulse">Initializing swarm...</div>
        )}
        {visibleLines.map((line, i) => (
          <div
            key={`${line.timestamp}-${i}`}
            className={`flex gap-2 ${lineColor(line)} ${
              i === visibleLines.length - 1 ? "animate-fade-in" : ""
            }`}
          >
            <span className="shrink-0 opacity-60">{lineTypePrefix(line.type)}</span>
            {line.agent && (
              <span
                className="shrink-0 font-bold"
                style={{ color: line.agentColor || undefined }}
              >
                {line.agent}:
              </span>
            )}
            <span className="break-words">{line.message}</span>
          </div>
        ))}
      </div>
      {/* Blinking cursor */}
      <div className="mt-1 text-green-400">
        <span className="animate-blink">█</span>
      </div>
    </div>
  );
}
