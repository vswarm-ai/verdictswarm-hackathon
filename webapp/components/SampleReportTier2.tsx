import SampleReportShell, { LockedBlock, MonoBlock } from "@/components/SampleReport";

export default function SampleReportTier2() {
  return (
    <SampleReportShell
      tier="tier2"
      badge="TIER 2 (PROSECUTOR · ~$500 in $VSWARM)"
      title="Example Token (EXM)"
      subtitle="Chain: Base"
      score="7.4/10"
      confidence="85%"
      ctaHref="/tokenomics"
      ctaLabel="Upgrade to Grand Jury"
    >
      <MonoBlock>{`FULL AI ANALYSIS
━━━━━━━━━━━━━━━━━━
🔒 SecurityBot (Sonnet): 7.5/10
   "Contract audit clean. No critical vulnerabilities.
    Minor: Centralized pause function exists.
    Mitigated by: 48h timelock on admin actions."

🐦 SocialBot (Grok 4): 7.8/10
   "Twitter sentiment positive. 12.4k organic followers.
    Low bot activity (8%). Community engagement strong.
    Recent mentions: 847 in 24h, 73% positive."

📊 TechnicalBot (GPT-4.5): 7.2/10
   "Price action healthy. RSI neutral at 52.
    Volume/MCap ratio: 0.08 (normal).
    Holder growth: +12% weekly."

💰 TokenomicsBot (Gemini Pro): 7.0/10
   "Supply distribution reasonable. Top 10: 34%.
    Team tokens vested 2 years. No unlock cliffs soon."

😈 DevilsAdvocate (Sonnet): 6.9/10
   "Concern: Similar projects failed in 2024.
    Counter: This team has shipped before.
    Risk flag: Dependent on single exchange listing."

VERDICT: CAUTIOUS BUY`}</MonoBlock>

      <div className="grid gap-3 md:grid-cols-2">
        <LockedBlock label="Full consensus debate transcript (TIER 3+)" />
        <LockedBlock label="Multi-provider cross-examination (TIER 3+)" />
      </div>

      <div className="text-sm text-white/65">→ Upgrade to Grand Jury tier for flagship models + debate protocol</div>
    </SampleReportShell>
  );
}
