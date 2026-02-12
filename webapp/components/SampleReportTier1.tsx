import SampleReportShell, { LockedBlock, MonoBlock } from "@/components/SampleReport";

export default function SampleReportTier1() {
  return (
    <SampleReportShell
      tier="tier1"
      badge="TIER 1 (INVESTIGATOR) · PRO"
      title="Example Token (EXM)"
      subtitle="Chain: Base"
      score="6.8/10"
      confidence="72%"
      ctaHref="/tiers"
      ctaLabel="Upgrade to Prosecutor"
    >
      <MonoBlock>{`AI ANALYSIS
━━━━━━━━━━━━━━━━━━
🔒 SecurityBot (Haiku): 7.2/10
   "Contract verified, standard ERC20 patterns..."

💰 TokenomicsBot (Gemini Flash): 6.5/10
   "Distribution shows 15% team allocation..."

📊 TechnicalBot (GPT-4o-mini): 6.8/10
   "Trading volume consistent..."

VERDICT: PROCEED WITH CAUTION`}</MonoBlock>

      <div className="grid gap-3 md:grid-cols-3">
        <LockedBlock label="SocialBot deep analysis (TIER 2+)" />
        <LockedBlock label="DevilsAdvocate review (TIER 2+)" />
        <LockedBlock label="Multi-provider debate (TIER 3+)" />
      </div>

      <div className="text-sm text-white/65">→ Upgrade to Prosecutor tier for full bot coverage</div>
    </SampleReportShell>
  );
}
