/**
 * VerdictSwarm - Proprietary Component
 * Copyright (c) 2026 VerdictSwarm. All rights reserved.
 * Licensed under BSL 1.1 - See LICENSE in repository root.
 * Unauthorized commercial use, copying, or distribution is prohibited.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { storeVerdictOnchain } from "@/lib/store-verdict-onchain";
import { useTimeline, TimelineProvider, LIVE_CONFIG, CACHED_CONFIG } from "../../lib/timeline";
import { HexagonGrid } from "./HexagonGrid";
import { TerminalLog } from "./TerminalLog";
import { DebateVisual } from "./DebateVisual";
import { PhaseIndicator } from "./PhaseIndicator";

function gradeColor(score: number): string {
  if (score >= 70) return "#00D4AA";
  if (score >= 50) return "#FFD700";
  return "#FF0055";
}

interface InterrogationRoomProps {
  address: string;
  chain?: string;
  tier?: string;
  fresh?: boolean;
  walletAddress?: string;
  onComplete?: (result: unknown) => void;
}

export function InterrogationRoom({
  address,
  chain = "base",
  tier = "FREE",
  fresh = false,
  walletAddress,
  onComplete,
}: InterrogationRoomProps) {
  const router = useRouter();
  const { frame, push, skipToEnd } = useTimeline(LIVE_CONFIG);
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [animatedScore, setAnimatedScore] = useState(0);
  const [onchainTx, setOnchainTx] = useState<{
    txSignature: string;
    network: string;
    explorerUrl: string;
    verdictPda?: string;
  } | null>(null);
  const [onchainError, setOnchainError] = useState<string | null>(null);
  const onchainFiredRef = useRef(false);
  const scoreRevealFiredRef = useRef(false);
  const completeFiredRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      address,
      chain,
      tier,
      ...(fresh ? { fresh: "1" } : {}),
      ...(walletAddress ? { walletAddress } : {}),
    });

    const es = new EventSource(`/api/scan/stream?${params.toString()}`);
    esRef.current = es;

    const handle = (event: MessageEvent, forcedType?: string) => {
      try {
        const parsed = JSON.parse(event.data);
        const type = forcedType || parsed?.type;
        const data = parsed?.data ?? parsed;
        const timestamp = parsed?.timestamp ?? Date.now();
        if (type) {
          push({ type, data, timestamp });
          if (type === 'scan:complete' || type === 'scan:error') {
            es.close();
          }
        }
      } catch {
        // ignore malformed event payloads
      }
    };

    const types = [
      "preprocess:start",
      "preprocess:complete",
      "scan:start",
      "scan:consensus",
      "scan:complete",
      "scan:error",
      "agent:start",
      "agent:thinking",
      "agent:finding",
      "agent:score",
      "agent:complete",
      "agent:error",
      "debate:start",
      "debate:message",
      "debate:resolved",
      "verdict:onchain",
    ];

    const listeners = types.map((type) => {
      const listener = (e: MessageEvent) => handle(e, type);
      es.addEventListener(type, listener as EventListener);
      return { type, listener };
    });

    es.onmessage = handle;
    es.onerror = () => {
      // EventSource will auto-reconnect when possible
    };

    return () => {
      listeners.forEach(({ type, listener }) => {
        es.removeEventListener(type, listener as EventListener);
      });
      es.close();
      esRef.current = null;
      skipToEnd();
    };
  }, [address, chain, tier, fresh, walletAddress, push, skipToEnd]);

  // Store onComplete in a ref to avoid effect re-runs when parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!frame.isComplete || !frame.result || completeFiredRef.current) return;
    completeFiredRef.current = true;
    const result = frame.result;
    const tx = onchainTx || frame.onchainTx || undefined;
    const cb = onCompleteRef.current;
    if (!cb) return;
    const timer = setTimeout(() => {
      cb({
        ...result,
        debates: result.debates || [],
        fullResults: result.fullResults || {},
        durationMs: result.durationMs || 0,
        agentCount: result.agentCount || 0,
        onchainTx: tx,
      });
    }, 2000);
    return () => clearTimeout(timer);
    // Only trigger on isComplete — result ref changes on every frame clone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.isComplete]);

  useEffect(() => {
    if (!frame.scoreRevealed || !frame.result || scoreRevealFiredRef.current) return;
    scoreRevealFiredRef.current = true;

    const targetScore = Math.round(frame.result.score);
    const duration = 1500;
    const steps = 60;
    const increment = targetScore / steps;
    let tick = 0;

    const timer = setInterval(() => {
      tick++;
      const current = Math.min(Math.round(increment * tick), targetScore);
      setAnimatedScore(current);
      if (current >= targetScore) clearInterval(timer);
    }, duration / steps);

    // Don't return cleanup — ref guard prevents double-fire, and we need
    // the animation to survive frame re-publishes (cloneFrame creates new
    // result references that would otherwise trigger effect cleanup)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.scoreRevealed, frame.isComplete]);

  useEffect(() => {
    if (!frame.isComplete || !frame.result || onchainFiredRef.current) return;
    if (!publicKey || !signTransaction) return; // no wallet connected
    onchainFiredRef.current = true;

    (async () => {
      try {
        // Check devnet SOL balance
        let balance = await connection.getBalance(publicKey);
        
        if (balance < 5_000_000) { // < 0.005 SOL
          console.log("[VerdictSwarm] Low devnet SOL, attempting airdrop...");
          try {
            const airdropSig = await connection.requestAirdrop(publicKey, 50_000_000); // 0.05 SOL
            await connection.confirmTransaction(airdropSig, "confirmed");
            console.log("[VerdictSwarm] Airdrop successful");
          } catch (airdropErr) {
            console.warn("[VerdictSwarm] Airdrop failed, proceeding to sign anyway:", airdropErr);
            // Don't return — still attempt signing, let Phantom handle insufficient funds
          }
        }

        const data = await storeVerdictOnchain(
          connection,
          publicKey,
          signTransaction,
          {
            address,
            chain,
            score: frame.result!.score,
            grade: frame.result!.grade,
            agentCount: frame.result!.agentCount,
            tier,
            fullReport: frame.result!.fullResults,
          }
        );

        if (data?.txSignature) {
          const txData = {
            txSignature: data.txSignature,
            network: "devnet",
            explorerUrl: data.explorerUrl,
            verdictPda: data.verdictPda,
          };
          setOnchainTx(txData);
          setOnchainError(null);
          // Persist to localStorage so the results page can pick it up
          // (signing completes after onComplete fires due to Phantom approval delay)
          try {
            localStorage.setItem(`vs:onchain:${address}`, JSON.stringify(txData));
          } catch {}
        } else {
          setOnchainError("⚠️ On-chain signing failed. Make sure Phantom is set to Devnet.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("User rejected")) {
          setOnchainError(null); // user cancelled, not an error
        } else {
          console.error("[VerdictSwarm] On-chain error:", msg);
          setOnchainError("⚠️ On-chain storage failed. Ensure Phantom is on Devnet with SOL.");
        }
      }
    })();
  }, [frame.isComplete, frame.result, address, chain, tier, publicKey, signTransaction, connection]);

  const totalAgents = frame.agents.size;
  const completedAgents = Array.from(frame.agents.values()).filter((a) => a.status === "complete").length;
  const debateRound = frame.debate?.messages?.length ? Math.max(...frame.debate.messages.map(m => m.round)) : undefined;
  const isDebating = frame.phase === "debating";

  return (
    <TimelineProvider frame={frame}>
      <div className="relative h-screen flex flex-col overflow-hidden">
        {/* Debate backdrop removed — debate details shown in final report */}

        <div className="relative z-20 pb-2 px-4 pt-14 text-center border-b border-[#2D2D3A] flex-shrink-0">
          <h1
            className="text-xl md:text-2xl font-bold tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-orbitron, monospace)" }}
          >
            <span className="text-[#6B46C1]">Verdict</span>
            <span className="text-[#00D4AA]">Swarm</span>
          </h1>
          <p className="text-[10px] text-gray-500 tracking-[0.3em] uppercase mt-0.5">War Room</p>
          <div className="mt-1.5 text-[9px] text-gray-400 font-mono">
            {frame.token?.name || `${address.slice(0, 6)}...${address.slice(-4)}`}
          </div>
        </div>

        <div className="relative z-20 flex-1 flex items-center justify-center overflow-hidden min-h-0">
          <HexagonGrid
            agents={frame.agents}
            activeAgentId={frame.activeAgentId}
            debateAgentIds={frame.debate?.agentIds}
            scanTier={tier.toUpperCase()}
          />

          {/* DebateVisual removed from scan — shown in report instead */}

          {frame.phase === "initializing" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="text-center space-y-3">
                <div className="text-4xl animate-pulse">🔍</div>
                <div className="text-sm font-medium text-[#00D4AA] tracking-wider uppercase animate-pulse">
                  Identifying Token...
                </div>
              </div>
            </div>
          )}

          {frame.phase === "consensus" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-xl font-bold text-[#00D4AA] animate-pulse">Swarm reaching consensus...</div>
            </div>
          )}

          <AnimatePresence>
            {frame.scoreRevealed && frame.result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-black/70"
              >
                <div className="text-center">
                  <div className="text-6xl font-black" style={{ color: gradeColor(animatedScore) }}>{animatedScore}</div>
                  <div className="text-xl text-white mt-1">Grade: {frame.result.grade}</div>
                  {(onchainTx || frame.onchainTx) && (
                    <div className="mt-3 text-center text-xs text-cyan-400">
                      On-chain verdict stored: {((onchainTx || frame.onchainTx)?.txSignature || "").slice(0, 12)}...
                    </div>
                  )}
                  {onchainError && !onchainTx && (
                    <div className="mt-3 text-center text-xs text-yellow-400">
                      {onchainError}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {frame.error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="text-center text-red-400 text-sm bg-black/70 px-4 py-2 rounded">{frame.error.message}</div>
            </div>
          )}
        </div>

        <div className="relative z-20 h-[180px] flex-shrink-0 border-t border-[#2D2D3A] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden px-4 pt-3">
            <TerminalLog lines={frame.terminalLines} />
          </div>
          <div className="pb-3 flex items-center justify-center gap-2">
            <PhaseIndicator phase={frame.phase} completedAgents={completedAgents} totalAgents={totalAgents} debateRound={debateRound} />
          </div>
        </div>
      </div>
    </TimelineProvider>
  );
}
