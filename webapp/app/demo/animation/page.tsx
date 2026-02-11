'use client';

import React, { useEffect, useMemo, useState } from 'react';
import SwarmAnimation from '../../../components/SwarmAnimation';

export default function DemoAnimationPage() {
  const steps = useMemo(
    () => [
      '🔍 Analyzing Contract...',
      '📊 Checking Liquidity...',
      '🐦 Scanning Socials...',
      '🧮 Evaluating Tokenomics...',
      '⚖️ Deliberating...',
    ],
    [],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [verdict, setVerdict] = useState<undefined | 'LOW_RISK' | 'FLAGGED'>(undefined);

  useEffect(() => {
    // Demo timeline ~12s total
    setCurrentStep(0);
    setVerdict(undefined);

    const timers: number[] = [];

    const stepEveryMs = 1800;
    for (let i = 1; i < steps.length; i++) {
      timers.push(
        window.setTimeout(() => {
          setCurrentStep(i);
        }, i * stepEveryMs),
      );
    }

    timers.push(
      window.setTimeout(() => {
        setVerdict(Math.random() > 0.55 ? 'LOW_RISK' : 'FLAGGED');
      }, steps.length * stepEveryMs + 1200),
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [steps]);

  return (
    <div className="min-h-screen bg-black">
      <SwarmAnimation
        steps={steps}
        currentStep={currentStep}
        verdict={verdict}
        onStepSound={(idx) => {
          // sound-ready hook
          void idx;
        }}
        onVerdictSound={(v) => {
          // sound-ready hook
          void v;
        }}
      />
    </div>
  );
}
