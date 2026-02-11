'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import SwarmAnimation, { type SwarmVerdict } from '@/components/SwarmAnimation';
import type { TierKey } from '@/lib/tier';

const DEFAULT_STEPS = ['Analyzing Contract...', 'Checking Liquidity...', 'Scanning Socials...', 'Deliberating...'];

function tierRank(key: TierKey): number {
  switch (key) {
    case 'FREE':
      return 0;
    case 'TIER_1':
      return 1;
    case 'TIER_2':
      return 2;
    case 'TIER_3':
      return 3;
    case 'SWARM_DEBATE':
      return 4;
  }
}

export default function SwarmScanOverlay({
  tierKey,
  isScanning,
  resultOverall,
  resultReady,
  onFinished,
  address,
  chain,
  steps = DEFAULT_STEPS,
  onStepSound,
  onVerdictSound,
}: {
  tierKey: TierKey;
  isScanning: boolean;
  resultReady: boolean;
  resultOverall?: number;
  onFinished: () => void;
  address?: string;
  chain?: string;
  steps?: string[];
  onStepSound?: (stepIndex: number) => void;
  onVerdictSound?: (verdict: SwarmVerdict) => void;
}) {
  const eligible = true; // tierRank(tierKey) >= tierRank('FREE');
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const verdict: SwarmVerdict | undefined = useMemo(() => {
    if (!eligible) return undefined;
    if (!resultReady) return undefined;
    const score = typeof resultOverall === 'number' ? resultOverall : 0;
    return score >= 8 ? 'LOW_RISK' : 'FLAGGED';
  }, [eligible, resultReady, resultOverall]);

  const startedAtRef = useRef<number>(0);
  const simTimerRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const verdictTimerRef = useRef<number | null>(null);

  // start/stop visibility when scan begins
  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return;
    }

    if (isScanning) {
      setVisible(true);
      setFading(false);
      setStepIndex(0);
      startedAtRef.current = Date.now();
    }
  }, [eligible, isScanning]);

  // simulate step progression if we don't get usable SSE events
  useEffect(() => {
    if (!eligible || !visible) return;

    // clear previous timer
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }

    // run a gentle progression until verdict
    simTimerRef.current = window.setInterval(() => {
      setStepIndex((s) => {
        if (verdict) return s;
        const max = Math.max(0, steps.length - 1);
        return Math.min(max, s + 1);
      });
    }, 1800);

    return () => {
      if (simTimerRef.current) {
        window.clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [eligible, visible, steps.length, verdict]);

  // optional: attach SSE stream to drive step progression (best-effort)
  useEffect(() => {
    if (!eligible || !visible) return;
    if (!address || !chain) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    // close any existing
    try {
      esRef.current?.close();
    } catch {
      // ignore
    }
    esRef.current = null;

    const url = `/api/scan/stream?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}&depth=full`;

    const es = new EventSource(url);
    esRef.current = es;

    const bumpStep = () => {
      setStepIndex((s) => Math.min(Math.max(0, steps.length - 1), s + 1));
    };

    // If server emits bot_start events, we can use them to advance.
    es.addEventListener('bot_start', () => bumpStep());
    es.addEventListener('start', () => setStepIndex(0));

    // do nothing on verdict here; ScanReport will close its own stream and set result.
    es.onerror = () => {
      try {
        es.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    };

    return () => {
      try {
        es.close();
      } catch {
        // ignore
      }
      esRef.current = null;
    };
  }, [eligible, visible, address, chain, steps.length]);

  // when verdict appears: wait ~2s, then fade out, then call onFinished
  useEffect(() => {
    if (!eligible || !visible) return;
    if (!verdict) return;

    if (verdictTimerRef.current) {
      window.clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = null;
    }

    // For FREE tier (or this specific animation spec), we might NOT want to auto-close
    // because the "Report Preview" is interactive.
    // For now, let's disable auto-close or make it very long if we are showing the Level 1 flow.
    // Assuming 'true' for eligible means we are in the flow.
    
    // verdictTimerRef.current = window.setTimeout(() => {
    //   setFading(true);
    //   window.setTimeout(() => {
    //     setVisible(false);
    //     setFading(false);
    //     onFinished();
    //   }, 450);
    // }, 2000);

    return () => {
      if (verdictTimerRef.current) {
        window.clearTimeout(verdictTimerRef.current);
        verdictTimerRef.current = null;
      }
    };
  }, [eligible, visible, verdict, onFinished]);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) window.clearInterval(simTimerRef.current);
      if (verdictTimerRef.current) window.clearTimeout(verdictTimerRef.current);
      try {
        esRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!eligible || !visible) return null;

  return (
    <div className={fading ? 'opacity-0 transition-opacity duration-450' : 'opacity-100 transition-opacity duration-450'}>
      <SwarmAnimation steps={steps} currentStep={stepIndex} verdict={verdict} onStepSound={onStepSound} onVerdictSound={onVerdictSound} />
    </div>
  );
}
