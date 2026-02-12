import Link from "next/link";

import SampleReportShell, { MonoBlock } from "@/components/SampleReport";

export default function SampleReportConsensus() {
  return (
    <SampleReportShell
      tier="consensus"
      badge="CONSENSUS TIER ⭐⭐ ULTIMATE"
      title="Example Token (EXM)"
      subtitle="Chain: Base"
      score="7.6/10"
      confidence="94%"
    >
      <div className="rounded-2xl border border-vs-purple/30 bg-gradient-to-r from-vs-purple/15 to-vs-cyan/10 p-5">
        <div className="text-sm font-semibold">⚖️ CONSENSUS DEBATE PROTOCOL</div>
        <div className="mt-1 text-xs text-white/60">See how models disagree, cross-examine, and converge.</div>
      </div>

      <MonoBlock>{`ROUND 1: INITIAL POSITIONS
├─ Claude Opus: "CAUTIOUS BUY - Strong fundamentals but..."
├─ GPT-5: "BUY - Technical setup favorable..."
├─ Gemini 3 Pro: "HOLD - Tokenomics concerns..."
├─ Grok 4: "BUY - Social momentum building..."
└─ Kimi K2.5: "CAUTIOUS BUY - Similar to successful projects..."

ROUND 2: CROSS-EXAMINATION
┌─────────────────────────────────────────────┐
│ GPT-5 challenges Gemini:                    │
│ "Your tokenomics concern is overweighted.   │
│  The 2-year vest mitigates unlock risk."    │
│                                             │
│ Gemini responds:                            │
│ "Acknowledged. Adjusting weight. However,   │
│  top 10 holder concentration remains high." │
│                                             │
│ DevilsAdvocate interjects:                  │
│ "Both miss the key risk: single exchange    │
│  dependency. If delisted, liquidity dies."  │
│                                             │
│ Grok 4 counters:                            │
│ "Social data shows 3 exchange partnerships  │
│  in negotiation. Risk is mitigated."        │
└─────────────────────────────────────────────┘

ROUND 3: CONSENSUS FORMATION
├─ Agreement: Contract security is solid (8/8 agree)
├─ Agreement: Team credibility verified (7/8 agree)
├─ Disagreement: Price entry timing (4 BUY, 4 WAIT)
└─ Resolution: "CAUTIOUS BUY" with position sizing advice

DISSENTING OPINION (Gemini 3 Pro):
"While I agree with the final verdict, I maintain
that investors should wait for the team token
unlock event in 3 months before taking large positions."

FINAL CONSENSUS: 7.6/10 - CAUTIOUS BUY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Enter with 50% position. Add on confirmation of
exchange partnership announcements. Set stop at -20%."`}</MonoBlock>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/samples"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 px-4 text-sm font-medium text-white hover:bg-white/5"
        >
          Run New Scan
        </Link>
        <a
          href="/samples/sample-consensus.pdf"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-vs-purple to-vs-cyan px-4 text-sm font-medium text-black shadow-glow hover:opacity-95"
        >
          Download Full PDF Report
        </a>
        <Link
          href="/samples"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/25 px-4 text-sm font-medium text-white hover:bg-white/5"
        >
          Share Report
        </Link>
      </div>
    </SampleReportShell>
  );
}
