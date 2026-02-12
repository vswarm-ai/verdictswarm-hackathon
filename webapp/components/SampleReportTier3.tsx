import SampleReportShell, { LockedBlock, MonoBlock } from "@/components/SampleReport";

export default function SampleReportTier3() {
  return (
    <SampleReportShell
      tier="tier3"
      badge="TIER 3 (GRAND JURY) ⭐ PREMIUM"
      title="Example Token (EXM)"
      subtitle="Chain: Base"
      score="7.6/10"
      confidence="94%"
      ctaHref="/tiers"
      ctaLabel="Upgrade to Consensus"
    >
      <MonoBlock>{`⚖️ FULL JURY ANALYSIS (ALL FLAGSHIP MODELS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 SecurityBot (Claude Opus): 7.8/10
   [Detailed 500-word analysis with code snippets,
    specific vulnerability assessment, comparison to
    similar contracts, historical context...]

🐦 SocialBot (Grok 4): 8.0/10
   [Real-time X sentiment with specific tweets cited,
    influencer mention tracking, bot detection analysis,
    community health metrics...]

📊 TechnicalBot (GPT-5): 7.5/10
   [Advanced chart pattern recognition, on-chain flow
    analysis, whale wallet tracking, liquidity depth...]

💰 TokenomicsBot (Gemini 3 Pro): 7.2/10
   [Vesting schedule analysis, emission curves,
    inflation impact modeling, holder distribution...]

🌍 MacroBot (Gemini 3 Pro): 7.4/10
   [Market cycle positioning, sector rotation analysis,
    correlation with BTC/ETH, macro risk factors...]

😈 DevilsAdvocate (Claude Opus): 7.0/10
   [Comprehensive bear case, historical parallels,
    risk scenarios, what could go wrong...]

👁️ VisionBot (Gemini Vision): 7.8/10
   [Website legitimacy check, UI clone detection,
    team photo verification, domain age...]

🤖 LLMScamBot (Semantic Analysis): 8.0/10
   [Contract intent analysis, hidden function detection,
    bytecode pattern matching...]

VERDICT: 7.6/10 — CAUTIOUS BUY
High confidence. Jury reached 94% consensus.`}</MonoBlock>

      <LockedBlock label="Consensus Debate Transcript (CONSENSUS TIER)" />

      <div className="text-sm text-white/65">→ Upgrade to Consensus tier to see HOW the jury reached this verdict</div>
    </SampleReportShell>
  );
}
