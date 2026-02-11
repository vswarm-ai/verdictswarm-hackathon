import React from "react";
import QRCode from "qrcode";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";

import type { TierKey } from "@/lib/tier";

export type PdfVitals = {
  contractVerified?: boolean;
  ageDays?: number;
  liquidityUsd?: number;
  holderCount?: number;
};

export type PdfRisk = {
  title: string;
  details?: string;
  codeSnippet?: string;
};

export type PdfBot = {
  name: string;
  emoji?: string;
  model?: string;
  score?: number;
  summary?: string;
  details?: string[];
};

export type PdfReportData = {
  tierKey: TierKey;
  address: string;
  chain: string;
  tokenName?: string;
  tokenSymbol?: string;
  overallScore?: number; // 0-10
  verdictLabel?: string;
  createdAtIso: string;
  vitals?: PdfVitals;
  bots?: PdfBot[];
  risks?: PdfRisk[];
  checksTotal?: number;
  checksIncluded?: number;
};

function money(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function yesNo(v: boolean | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function shortAddress(a: string): string {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, scale: 6 });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 34,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0B1220",
  },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  sub: { color: "#6B7280" },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  verdictRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  verdictLabel: { fontSize: 26, fontWeight: 800 },
  score: { fontSize: 36, fontWeight: 800 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    fontSize: 9,
    fontWeight: 700,
  },
  vitalsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  vitalsItem: { flexGrow: 1 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12 },
  bullet: { marginTop: 4 },
  watermark: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 26,
    color: "#111827",
    opacity: 0.06,
    transform: "rotate(-20deg)",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#6B7280",
  },
  qrRow: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 10 },
  qr: { width: 110, height: 110 },
  code: { fontFamily: "Courier", fontSize: 8, backgroundColor: "#F3F4F6", padding: 8, borderRadius: 8 },
});

function verdictColor(score: number | undefined): string {
  if (typeof score !== "number") return "#111827";
  if (score >= 7.5) return "#059669";
  if (score >= 5) return "#D97706";
  return "#DC2626";
}

export async function renderPdfReport(data: PdfReportData): Promise<Buffer> {
  const isFree = data.tierKey === "FREE";
  const total = data.checksTotal ?? 34;
  const included = data.checksIncluded ?? (isFree ? 4 : total);

  const upgradeUrl = `https://verdictswarm.io/upgrade?address=${encodeURIComponent(data.address)}&chain=${encodeURIComponent(data.chain)}`;
  const qrUrl = isFree ? await qrDataUrl(upgradeUrl) : null;

  const risks = data.risks ?? [];

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {isFree && <Text style={styles.watermark}>FREE TIER REPORT — Full analysis at verdictswarm.io</Text>}

        <View>
          <Text style={styles.headerTitle}>VerdictSwarm</Text>
          <Text style={styles.sub}>Generated: {new Date(data.createdAtIso).toLocaleString("en-US")}</Text>
          <Text style={styles.sub}>
            Token: {data.tokenName ?? "Unknown"} ({data.tokenSymbol ?? "—"}) • Chain: {data.chain}
          </Text>
          <Text style={styles.sub}>Contract: {data.address}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.verdictRow}>
            <View>
              <Text style={[styles.verdictLabel, { color: verdictColor(data.overallScore) }]}>{data.verdictLabel ?? "VERDICT"}</Text>
              <Text style={styles.sub}>Shareable snapshot verdict</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.score}>{typeof data.overallScore === "number" ? data.overallScore.toFixed(1) : "—"}</Text>
              <Text style={styles.sub}>Overall score (0–10)</Text>
              <Text style={styles.badge}>{isFree ? "FREE TIER" : "VERIFIED BY VERDICTSWARM"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic vitals</Text>
          <View style={styles.vitalsRow}>
            <View style={styles.vitalsItem}>
              <Text style={styles.sub}>Contract verified</Text>
              <Text>{yesNo(data.vitals?.contractVerified)}</Text>
            </View>
            <View style={styles.vitalsItem}>
              <Text style={styles.sub}>Age</Text>
              <Text>{typeof data.vitals?.ageDays === "number" ? `${data.vitals?.ageDays}d` : "—"}</Text>
            </View>
            <View style={styles.vitalsItem}>
              <Text style={styles.sub}>Liquidity</Text>
              <Text>{money(data.vitals?.liquidityUsd)}</Text>
            </View>
            <View style={styles.vitalsItem}>
              <Text style={styles.sub}>Holders</Text>
              <Text>
                {typeof data.vitals?.holderCount === "number" ? new Intl.NumberFormat("en-US").format(data.vitals?.holderCount) : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isFree ? "Risk preview" : "Risks & flags"}</Text>
          {risks.length === 0 ? (
            <Text style={styles.sub}>No critical risks detected.</Text>
          ) : (
            <View>
              <Text style={{ fontWeight: 700, color: isFree ? "#D97706" : "#DC2626" }}>
                {risks.length} risk{risks.length === 1 ? "" : "s"} found
              </Text>
              {(isFree ? risks.slice(0, 2) : risks).map((r, idx) => (
                <View key={`${r.title}:${idx}`} style={styles.bullet}>
                  <Text>• {r.title}</Text>
                  {isFree ? (
                    <Text style={styles.sub}>Details locked — upgrade to unlock.</Text>
                  ) : (
                    <>
                      {r.details && <Text style={styles.sub}>{r.details}</Text>}
                      {r.codeSnippet && <Text style={styles.code}>{r.codeSnippet}</Text>}
                    </>
                  )}
                </View>
              ))}
              {isFree && risks.length > 2 && <Text style={styles.sub}>(additional risks hidden)</Text>}
            </View>
          )}
        </View>

        {isFree ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Checks</Text>
            <Text style={styles.sub}>
              {included} of {total} checks included
            </Text>
            <View style={{ marginTop: 8 }}>
              {[
                "Owner privileges",
                "Honeypot risk",
                "Proxy / upgradeability",
                "Transfer restrictions",
                "LP lock verification",
                "Tax changes",
                "Blacklist / whitelist",
                "Mint functions",
                "Trading cooldowns",
                "Suspicious events",
                "Top holder concentration",
                "CEX wallet interactions",
                "Social sentiment",
                "Contract similarity",
                "Audit references",
                "Deployer history",
                "Backdoor patterns",
                "Re-entrancy patterns",
                "Permit safety",
                "MEV sensitivity",
                "DEX liquidity routing",
                "Anti-bot traps",
                "Delayed rug patterns",
                "Hidden approvals",
                "Unlimited allowances",
                "External call graph",
                "Price manipulation signals",
                "LP burn history",
                "Treasury extraction",
                "Dev wallet clustering",
                "Supply schedule",
                "Bridge / chain risks",
                "Off-chain social proof",
                "Community health",
              ].slice(0, 34).map((c) => (
                <Text key={c} style={styles.sub}>
                  🔒 {c}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bot analyses</Text>
            {(data.bots ?? []).slice(0, 10).map((b, idx) => (
              <View key={`${b.name}:${idx}`} style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: 700 }}>
                  {(b.emoji ?? "").trim()} {b.name}
                </Text>
                <Text style={styles.sub}>
                  {b.model ? `Model: ${b.model}` : ""}
                  {typeof b.score === "number" ? `   •   Score: ${b.score.toFixed(1)}` : ""}
                </Text>
                {b.summary && <Text style={styles.sub}>{b.summary}</Text>}
                {(b.details ?? []).slice(0, 6).map((d, j) => (
                  <Text key={`${d}:${j}`} style={styles.sub}>
                    • {d}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {isFree && qrUrl && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Unlock the full report</Text>
            <Text style={styles.sub}>Scan the QR to upgrade and download the full analysis.</Text>
            <View style={styles.qrRow}>
              {/* react-pdf Image doesn't support alt; disable a11y lint for this line */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qr} src={qrUrl} />
              <View style={{ flexGrow: 1 }}>
                <Text style={styles.sub}>{upgradeUrl}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>Scanned by VerdictSwarm</Text>
      </Page>
    </Document>
  );

  const out = await pdf(doc).toBuffer();
  return Buffer.isBuffer(out) ? out : Buffer.from(out as unknown as ArrayBuffer);
}

export function verdictForScore(score: number | undefined): string {
  if (typeof score !== "number") return "UNKNOWN";
  return score >= 7.5 ? "HEALTHY" : "UNHEALTHY";
}

export function safeFilename(input: { tokenSymbol?: string; address: string; chain: string; tierKey: TierKey }): string {
  const sym = (input.tokenSymbol ?? "TOKEN").replace(/[^a-z0-9_-]+/gi, "");
  const addr = shortAddress(input.address).replace(/[^a-z0-9…]+/gi, "");
  const tier = input.tierKey === "FREE" ? "free" : "full";
  return `verdictswarm-${sym}-${input.chain}-${addr}-${tier}.pdf`;
}
