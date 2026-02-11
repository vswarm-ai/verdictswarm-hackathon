import SampleReportShell, { LockedBlock, MonoBlock } from "@/components/SampleReport";

export default function SampleReportFree() {
  return (
    <SampleReportShell
      tier="free"
      badge="FREE (SCOUT)"
      title="Example Token (EXM)"
      subtitle="Chain: Base"
      ctaHref="/tokenomics"
      ctaLabel="Upgrade to Investigator"
    >
      <MonoBlock>{`BASIC SCAN RESULTS
━━━━━━━━━━━━━━━━━━
✅ Contract Verified
⚠️ Honeypot patterns: Unknown
⚠️ Liquidity lock: Unknown

Score: N/A (Upgrade for AI analysis)`}</MonoBlock>

      <div className="grid gap-3 md:grid-cols-2">
        <LockedBlock label="SecurityBot analysis" />
        <LockedBlock label="SocialBot analysis" />
        <LockedBlock label="TechnicalBot analysis" />
        <LockedBlock label="Full verdict" />
      </div>

      <div className="text-sm text-white/65">→ Upgrade to Investigator tier for AI-powered analysis</div>
    </SampleReportShell>
  );
}
