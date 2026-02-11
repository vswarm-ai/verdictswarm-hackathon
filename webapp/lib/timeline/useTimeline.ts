"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TimelineDirector } from "./director";
import type { RawSSEEvent, TimelineConfig, TimelineFrame } from "./types";
import { INITIAL_FRAME } from "./types";

export function useTimeline(config: TimelineConfig) {
  const directorRef = useRef<TimelineDirector | null>(null);
  const [frame, setFrame] = useState<TimelineFrame>(INITIAL_FRAME);

  useEffect(() => {
    const director = new TimelineDirector(config);
    directorRef.current = director;
    const unsub = director.subscribe(setFrame);

    return () => {
      unsub();
      director.destroy();
      directorRef.current = null;
    };
  }, [config]);

  const push = useCallback((event: RawSSEEvent) => {
    directorRef.current?.push(event);
  }, []);

  const skipToEnd = useCallback(() => {
    directorRef.current?.skipToEnd();
  }, []);

  return { frame, push, skipToEnd };
}