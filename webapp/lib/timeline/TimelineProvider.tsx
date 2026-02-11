"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TimelineFrame } from "./types";
import { INITIAL_FRAME } from "./types";

const TimelineContext = createContext<TimelineFrame>(INITIAL_FRAME);

export function TimelineProvider({ frame, children }: { frame: TimelineFrame; children: ReactNode }) {
  return <TimelineContext.Provider value={frame}>{children}</TimelineContext.Provider>;
}

export function useTimelineFrame() {
  return useContext(TimelineContext);
}