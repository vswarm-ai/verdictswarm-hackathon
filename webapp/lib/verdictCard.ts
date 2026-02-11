export type VerdictCardInput = {
  tokenName: string;
  tokenSymbol?: string | null;
  verdict: string; // e.g. "AAA", "BB", "F", or "LOW_RISK"
  score?: number | null; // 0–10 optional
  findings: string[]; // 3–5 bullet points
  reportUrl?: string | null; // optional for QR
};

export function clampFindings(findings: unknown): string[] {
  const arr = Array.isArray(findings) ? findings : [];
  return arr
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
}

export function safeText(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function safeScore(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function verdictAccent(verdict: string): {
  accent: string;
  badgeBg: string;
  badgeText: string;
} {
  const v = verdict.toUpperCase();

  if (["AAA", "AA", "A", "LOW_RISK", "HEALTHY"].includes(v)) {
    return { accent: "#20E3B2", badgeBg: "rgba(32,227,178,0.12)", badgeText: "#20E3B2" };
  }
  if (["BBB", "BB", "B", "B+", "B-", "C", "C+", "C-", "PROCEED WITH CAUTION", "CAUTION", "UNHEALTHY"].includes(v)) {
    return { accent: "#F4C152", badgeBg: "rgba(244,193,82,0.12)", badgeText: "#F4C152" };
  }
  return { accent: "#FF4D6D", badgeBg: "rgba(255,77,109,0.12)", badgeText: "#FF4D6D" };
}

export function buildDefaultReportUrl(address?: string | null, chain?: string | null): string | undefined {
  if (!address) return undefined;
  const c = chain ?? "base";
  return `https://verdictswarm.io/scan/${encodeURIComponent(address)}?chain=${encodeURIComponent(c)}`;
}
