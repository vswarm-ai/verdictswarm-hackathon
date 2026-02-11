"use client";

/**
 * SSE Connection Manager with Fallback
 *
 * Provides a resilient connection to the scan stream endpoint.
 * Falls back from SSE → polling → static when connections fail.
 *
 * See docs/STREAMING_ARCHITECTURE.md — Fallback Strategy.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type ConnectionMode = "sse" | "polling" | "static";

interface ScanConnectionOptions {
  /** Max SSE errors before falling back to polling */
  maxSseErrors?: number;
  /** Max polling errors before falling back to static */
  maxPollErrors?: number;
  /** Polling interval in ms */
  pollIntervalMs?: number;
  /** Base URL for API */
  apiBase?: string;
}

interface ScanConnectionState {
  mode: ConnectionMode;
  connected: boolean;
  error: string | null;
  reconnectCount: number;
}

const DEFAULT_OPTIONS: Required<ScanConnectionOptions> = {
  maxSseErrors: 3,
  maxPollErrors: 3,
  pollIntervalMs: 2000,
  apiBase: process.env.NEXT_PUBLIC_API_URL || "",
};

export function useScanConnection(options?: ScanConnectionOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<ScanConnectionState>({
    mode: "sse",
    connected: false,
    error: null,
    reconnectCount: 0,
  });

  const sseErrorCount = useRef(0);
  const pollErrorCount = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(
    (
      url: string,
      onEvent: (type: string, data: Record<string, unknown>) => void,
      onError?: (err: string) => void,
    ) => {
      cleanup();

      const source = new EventSource(url);
      eventSourceRef.current = source;

      setState((s) => ({ ...s, mode: "sse", connected: false, error: null }));

      source.onopen = () => {
        sseErrorCount.current = 0;
        setState((s) => ({ ...s, connected: true, error: null }));
      };

      source.onerror = () => {
        sseErrorCount.current++;
        if (source.readyState === EventSource.CLOSED) {
          if (sseErrorCount.current >= opts.maxSseErrors) {
            // Fall back to polling
            setState((s) => ({
              ...s,
              mode: "polling",
              connected: false,
              error: "SSE connection failed, falling back to polling",
              reconnectCount: s.reconnectCount + 1,
            }));
            source.close();
            onError?.("SSE failed — falling back to polling");
          } else {
            setState((s) => ({
              ...s,
              connected: false,
              reconnectCount: s.reconnectCount + 1,
            }));
          }
        }
      };

      // Generic message handler
      source.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onEvent("message", data);
        } catch {
          // ignore parse errors
        }
      };

      return source;
    },
    [cleanup, opts.maxSseErrors],
  );

  const startPolling = useCallback(
    (
      statusUrl: string,
      onUpdate: (data: Record<string, unknown>) => void,
      onError?: (err: string) => void,
    ) => {
      cleanup();
      setState((s) => ({ ...s, mode: "polling", connected: true, error: null }));

      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(statusUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          pollErrorCount.current = 0;
          onUpdate(data);

          // Stop polling when scan is complete or errored
          if (data.state === "complete" || data.state === "error") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        } catch {
          pollErrorCount.current++;
          if (pollErrorCount.current >= opts.maxPollErrors) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setState((s) => ({
              ...s,
              mode: "static",
              connected: false,
              error: "Polling failed — waiting for final result",
            }));
            onError?.("Polling failed — falling back to static");
          }
        }
      }, opts.pollIntervalMs);
    },
    [cleanup, opts.maxPollErrors, opts.pollIntervalMs],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    connectSSE,
    startPolling,
    cleanup,
  };
}
