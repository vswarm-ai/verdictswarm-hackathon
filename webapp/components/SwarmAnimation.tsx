/**
 * VerdictSwarm - Proprietary Component
 * Copyright (c) 2026 VerdictSwarm. All rights reserved.
 * Licensed under BSL 1.1 - See LICENSE in repository root.
 * Unauthorized commercial use, copying, or distribution is prohibited.
 */
'use client';

import React, { useEffect, useState, useMemo } from 'react';

export type SwarmVerdict = 'LOW_RISK' | 'FLAGGED';

export type SwarmAnimationProps = {
  steps: string[];
  currentStep: number;
  verdict?: SwarmVerdict;
  onStepSound?: (stepIndex: number) => void;
  onVerdictSound?: (verdict: SwarmVerdict) => void;
};

type Phase = 'REVEAL' | 'DELIBERATION' | 'VERDICT_TEASE' | 'REPORT_PREVIEW';

export default function SwarmAnimation({
  steps,
  currentStep,
  verdict,
  onStepSound,
  onVerdictSound,
}: SwarmAnimationProps) {
  const [phase, setPhase] = useState<Phase>('REVEAL');
  const [showGoldFlash, setShowGoldFlash] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // For the 0.3s flash transition

  // Phase management
  useEffect(() => {
    // START -> REVEAL (0s)
    
    // 0.3s: Lock the non-active bees (Flash end)
    const tLock = setTimeout(() => {
      setIsLocked(true);
    }, 300);

    // REVEAL -> DELIBERATION (1.5s)
    const t1 = setTimeout(() => {
      setPhase('DELIBERATION');
    }, 1500);

    return () => {
      clearTimeout(tLock);
      clearTimeout(t1);
    };
  }, []);

  useEffect(() => {
    if (phase === 'DELIBERATION') {
      // Loop Deliberation until verdict is ready, but minimum duration
      // Spec: 1.5s -> 5s (3.5s duration)
      // If verdict comes later, we extend this phase.
      const minDeliberationDuration = 3500;
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= minDeliberationDuration && verdict) {
          setPhase('VERDICT_TEASE');
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [phase, verdict]);

  useEffect(() => {
    if (phase === 'VERDICT_TEASE') {
      // 5s -> 6.5s (1.5s duration)
      // Flash at start
      setShowGoldFlash(true);
      const tFlash = setTimeout(() => setShowGoldFlash(false), 200);
      
      // Transition to Report
      const tNext = setTimeout(() => {
        setPhase('REPORT_PREVIEW');
      }, 1500);
      
      return () => {
        clearTimeout(tFlash);
        clearTimeout(tNext);
      };
    }
  }, [phase]);

  // Sound triggers
  useEffect(() => {
    if (phase === 'REVEAL') onStepSound?.(0);
    if (phase === 'DELIBERATION') onStepSound?.(1);
    if (phase === 'VERDICT_TEASE') onStepSound?.(2);
    if (phase === 'REPORT_PREVIEW') onVerdictSound?.(verdict || 'LOW_RISK');
  }, [phase, verdict, onStepSound, onVerdictSound]);

  // Bee Grid Configuration
  // 3 rows of 4
  const bees = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      // Active bees: Indices 5, 6, 7 (Middle row, center-right)
      // Spec visual: "Only 3 bees active".
      // We select indices 5, 6, 7 to form the active cluster.
      const isActuallyActive = (i === 5 || i === 6 || i === 7);
      
      return {
        id: i,
        active: isActuallyActive,
        row: Math.floor(i / 4),
        col: i % 4,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-950 font-sans text-white">
      {/* Background/Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
      <div className="absolute inset-0 bg-[url('/assets/grid-pattern.svg')] opacity-10" /> {/* Optional texture */}

      {/* Gold Flash (Verdict Tease) */}
      <div 
        className={`pointer-events-none absolute inset-0 z-50 bg-yellow-400 mix-blend-overlay transition-opacity duration-200 ${
          showGoldFlash ? 'opacity-40' : 'opacity-0'
        }`} 
      />

      {/* LEVEL 1 SCAN BADGE (Top Right) */}
      <div 
        className={`absolute right-6 top-6 z-40 transition-all duration-700 ${
           isLocked ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <img src="/assets/2026-02-05-level-1-badge.png" alt="Level 1 Scan" className="h-12 w-auto drop-shadow-lg" />
      </div>

      {/* PROGRESS BAR SIDEBAR (Left - Deliberation Phase) */}
      <div 
        className={`absolute left-6 top-1/2 z-40 -translate-y-1/2 transform transition-all duration-700 ${
          phase === 'DELIBERATION' || phase === 'VERDICT_TEASE' ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/60 p-5 backdrop-blur-md">
           <div className="text-xs font-bold tracking-widest text-slate-400">LOCKED FEATURES</div>
           <div className="space-y-3 text-sm text-slate-500">
             <div className="flex items-center gap-2"><span className="opacity-70">🔒</span> VisionBot <span className="text-[10px] text-slate-600">(Tier 1+)</span></div>
             <div className="flex items-center gap-2"><span className="opacity-70">🔒</span> Advanced AI <span className="text-[10px] text-slate-600">(Tier 1+)</span></div>
             <div className="flex items-center gap-2"><span className="opacity-70">🔒</span> Real-time Alerts <span className="text-[10px] text-slate-600">(Tier 3+)</span></div>
             <div className="flex items-center gap-2"><span className="opacity-70">🔒</span> Multi-Model Debate</div>
           </div>
           
           <div className="mt-2 border-t border-white/10 pt-3">
             <div className="mb-1 text-xs text-yellow-400">💡 73% to Investigator Tier</div>
             <img src="/assets/2026-02-05-progress-bar.png" alt="Progress" className="w-48 opacity-90" />
           </div>
        </div>
      </div>

      {/* CENTRAL CONTENT */}
      <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center transition-all duration-1000 ${
          phase === 'REPORT_PREVIEW' ? '-translate-y-12 scale-90 opacity-40 blur-sm' : ''
      }`}>
        
        {/* Phase Text */}
        <div className="absolute top-[15%] text-center">
             {phase === 'REVEAL' && <div className="animate-pulse text-xl font-light text-blue-300">INITIALIZING SWARM...</div>}
             {phase === 'DELIBERATION' && (
                 <div className="flex flex-col items-center gap-2">
                     <div className="text-lg font-medium text-blue-200">Activating Basic Swarm...</div>
                     <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-4 py-1 text-sm text-slate-400 backdrop-blur">
                         <span>🔒</span> 9 Advanced Agents Locked
                     </div>
                 </div>
             )}
             {phase === 'VERDICT_TEASE' && <div className="scale-110 text-2xl font-bold text-white transition-transform duration-300">CONVERGING...</div>}
        </div>

        {/* BEES GRID */}
        {/* Using a grid layout that shifts slightly for hex effect */}
        <div className={`relative grid grid-cols-4 gap-x-8 gap-y-6 transition-all duration-1000 ${
            phase === 'VERDICT_TEASE' ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
        }`}>
           {/* Connecting Lines (SVG) - Visible only in Deliberation */}
           <svg className={`absolute inset-0 h-full w-full overflow-visible transition-opacity duration-500 ${
               phase === 'DELIBERATION' ? 'opacity-100' : 'opacity-0'
           }`}>
               {/* Simple connections between active bees (5, 6, 7) */}
               {/* Coordinate mapping approximate for visual effect */}
               <line x1="38%" y1="50%" x2="62%" y2="50%" stroke="#60A5FA" strokeWidth="1" strokeOpacity="0.4" className="animate-pulse" />
               <line x1="62%" y1="50%" x2="86%" y2="50%" stroke="#60A5FA" strokeWidth="1" strokeOpacity="0.4" className="animate-pulse delay-75" />
           </svg>

           {bees.map((bee) => (
             <div 
               key={bee.id} 
               className={`relative flex h-16 w-16 items-center justify-center transition-all duration-700
                 ${bee.row === 1 ? 'translate-x-4' : ''} 
                 ${bee.row === 2 ? 'translate-x-8' : ''}
               `}
             >
                {/* Bee Sprite */}
                <div className={`relative h-full w-full transition-all duration-500 ${
                    !isLocked ? 'scale-100 opacity-100' : // Full grid visible at start
                    bee.active ? 'scale-110' : 'scale-90 opacity-40 grayscale' // Then fade locked ones
                }`}>
                    <img 
                        src={bee.active || !isLocked ? "/assets/2026-02-05-bee-agent-active.png" : "/assets/2026-02-05-bee-agent-locked.png"} 
                        alt="Bee"
                        className={`h-full w-full object-contain ${
                            bee.active && phase === 'DELIBERATION' ? 'animate-bounce-subtle drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''
                        }`} 
                    />
                    
                    {/* Lock Overlay for inactive bees */}
                    {!bee.active && isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl drop-shadow-md">🔒</span>
                        </div>
                    )}
                </div>
             </div>
           ))}
        </div>
        
        {/* Verdict Display (Phase 3 end) */}
        {phase === 'VERDICT_TEASE' && !showGoldFlash && (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-scale-in text-center">
                    <div className="text-4xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                        VERDICT: {verdict === 'LOW_RISK' ? '8/10' : '3/10'}
                    </div>
                    <div className={`mt-2 text-xl font-bold ${verdict === 'LOW_RISK' ? 'text-green-400' : 'text-red-400'}`}>
                        {verdict === 'LOW_RISK' ? '✅ LOW RISK' : '⚠️ CAUTION'}
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* REPORT PREVIEW (Phase 4) - Bottom Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-50 flex h-[60%] flex-col items-center justify-start rounded-t-3xl border-t border-white/20 bg-slate-900/95 shadow-2xl backdrop-blur-xl transition-transform duration-700 ${
          phase === 'REPORT_PREVIEW' ? 'translate-y-0' : 'translate-y-full'
      }`}>
          <div className="mt-2 h-1 w-16 rounded-full bg-white/20" />
          
          <div className="mt-6 w-full max-w-2xl px-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                      <h2 className="text-xl font-bold text-white">VERDICTSWARM REPORT</h2>
                      <div className="text-sm text-slate-400">Level 1 (Basic)</div>
                  </div>
                  <div className="text-right">
                      <div className={`text-xl font-bold ${verdict === 'LOW_RISK' ? 'text-green-400' : 'text-red-400'}`}>
                          {verdict === 'LOW_RISK' ? 'LOW RISK' : 'FLAGGED'}
                      </div>
                  </div>
              </div>

              <div className="mt-6 space-y-4 opacity-50 blur-[1px]">
                 {/* Fake blurred content */}
                 <div className="h-4 w-3/4 rounded bg-slate-700" />
                 <div className="h-4 w-full rounded bg-slate-700" />
                 <div className="h-32 w-full rounded bg-slate-800/50" />
              </div>

              {/* LOCK OVERLAY */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pt-20">
                  <div className="mb-2 text-3xl">🔒</div>
                  <h3 className="text-lg font-bold text-white">Unlock Full Report</h3>
                  <p className="mb-6 text-sm text-slate-400">Premium insights available with Pro tier</p>
                  
                  <button className="rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-8 py-3 font-bold text-black shadow-lg shadow-yellow-500/20 hover:scale-105 transition-transform">
                      Upgrade to Investigator
                  </button>
                  
                  <div className="mt-4 flex gap-4 text-xs text-slate-500">
                      <span>• Detailed risk breakdown</span>
                      <span>• AI confidence scores</span>
                      <span>• Deep analysis</span>
                  </div>
              </div>
          </div>
      </div>
      
      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
        .animate-scale-in {
            animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes scaleIn {
            from { transform: scale(0.5); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
