import { NextResponse } from "next/server";

export const runtime = "nodejs";

import QRCode from "qrcode";

import {
  clampFindings,
  safeScore,
  safeText,
  verdictAccent,
  type VerdictCardInput,
} from "@/lib/verdictCard";

type AgentScore = {
  label: string;
  score: number;
  icon?: string;
};

type Body = {
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  verdict?: string;
  score?: number;
  findings?: string[];
  reportUrl?: string;
  summary?: string;
  agentCount?: number;
  durationSec?: number;
  agents?: AgentScore[];
  mcap?: string;
  liquidity?: string;
  age?: string;
  chain?: string;
};

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function pickFonts(): string {
  return `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
}

function scoreColor(score: number): string {
  if (score >= 7) return "#00D4AA";
  if (score >= 5) return "#FFD700";
  return "#FF0055";
}

function fmtNum(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export async function POST(req: Request) {
  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = null;
  }

  const tokenName = safeText(body?.tokenName, "Unknown Token");
  const tokenSymbol = safeText(body?.tokenSymbol, "");
  const verdict = safeText(body?.verdict, "UNKNOWN");
  const score = safeScore(body?.score);
  const findings = clampFindings(body?.findings);
  const reportUrl = safeText(body?.reportUrl, "");
  const summary = safeText(body?.summary, "");
  const agentCount = body?.agentCount || 0;
  const durationSec = body?.durationSec || 0;
  const agents: AgentScore[] = (body?.agents || []).slice(0, 6);
  const mcap = safeText(body?.mcap, "");
  const liquidity = safeText(body?.liquidity, "");
  const age = safeText(body?.age, "");
  const chain = safeText(body?.chain, "");

  const input: VerdictCardInput = {
    tokenName,
    tokenSymbol: tokenSymbol || undefined,
    verdict,
    score,
    findings,
    reportUrl: reportUrl || undefined,
  };

  const { accent, badgeBg, badgeText } = verdictAccent(input.verdict);

  const W = 1200;
  const H = 630;

  const qr = input.reportUrl
    ? await QRCode.toDataURL(input.reportUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 200,
        color: { dark: "#FFFFFF", light: "#00000000" },
      }).catch(() => null)
    : null;

  const bullets = (input.findings.length ? input.findings : ["No key findings available."]).slice(0, 3);
  const header = `${escapeXml(input.tokenName)}${input.tokenSymbol ? ` <tspan fill="rgba(255,255,255,0.50)">(${escapeXml(input.tokenSymbol)})</tspan>` : ""}`;

  const F = pickFonts();

  // Agent score bars
  const agentBarsY = 235;
  const agentRowH = agents.length > 5 ? 28 : 34;
  const agentBars = agents.map((a, i) => {
    const y = agentBarsY + i * agentRowH;
    const barWidth = Math.round(a.score * 38); // max 380px for score 10
    const color = scoreColor(a.score);
    return `
    <text x="96" y="${y + 14}" font-family="${F}" font-size="12" font-weight="600" fill="rgba(255,255,255,0.60)" letter-spacing="0.5">${escapeXml(a.label)}</text>
    <rect x="220" y="${y + 3}" width="380" height="14" rx="3" fill="rgba(255,255,255,0.06)"/>
    <rect x="220" y="${y + 3}" width="${barWidth}" height="14" rx="3" fill="${color}"/>
    <text x="610" y="${y + 14}" font-family="${F}" font-size="13" font-weight="700" fill="${color}">${a.score.toFixed(1)}</text>`;
  }).join("\n");

  // Meta badges (chain, mcap, liquidity, age)
  const metaBadges: string[] = [];
  if (chain) metaBadges.push(chain.toUpperCase());
  if (mcap) metaBadges.push(`MCap ${mcap}`);
  if (liquidity) metaBadges.push(`Liq ${liquidity}`);
  if (age) metaBadges.push(age);
  
  const metaRow = metaBadges.map((badge, i) => {
    const x = 96 + i * 155;
    return `<rect x="${x}" y="148" width="${Math.min(145, badge.length * 9 + 20)}" height="24" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>
    <text x="${x + 10}" y="164" font-family="${F}" font-size="11" font-weight="600" fill="rgba(255,255,255,0.45)">${escapeXml(badge)}</text>`;
  }).join("\n");

  // Right column: Score + Grade — centered in right third of card
  const scoreX = 700;
  const scoreCenterX = 950; // visual center of right column

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="60%" stop-color="#0A0B0F"/>
      <stop offset="100%" stop-color="#07070B"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6B46C1"/>
      <stop offset="100%" stop-color="#00D4AA"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" result="bb"/>
      <feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Frame -->
  <rect x="48" y="42" width="${W - 96}" height="${H - 84}" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.10)"/>
  <rect x="64" y="58" width="${W - 128}" height="${H - 116}" rx="18" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.06)"/>

  <!-- Accent glows -->
  <circle cx="${scoreCenterX}" cy="200" r="180" fill="${accent}" opacity="0.10" filter="url(#soft)"/>
  <circle cx="120" cy="520" r="120" fill="#6B46C1" opacity="0.06" filter="url(#soft)"/>

  <!-- Brand bar top -->
  <rect x="64" y="58" width="${W - 128}" height="4" rx="2" fill="url(#brand)"/>

  <!-- VerdictSwarm branding top-right -->
  <text x="1100" y="95" text-anchor="end" font-family="${F}" font-size="13" font-weight="700" fill="rgba(255,255,255,0.40)" letter-spacing="1">verdictswarm.io</text>

  <!-- Token name -->
  <text x="96" y="128" font-family="${F}" font-size="34" font-weight="700" fill="#FFFFFF">${header}</text>

  <!-- Meta badges row -->
  ${metaRow}

  <!-- LEFT COLUMN: Agent Scores -->
  <text x="96" y="${agentBarsY - 8}" font-family="${F}" font-size="12" font-weight="700" fill="rgba(255,255,255,0.40)" letter-spacing="1.5">AGENT ANALYSIS${agentCount ? ` · ${agentCount} AGENTS` : ""}</text>
  ${agentBars}

  <!-- RIGHT COLUMN: Score + Grade — vertically centered -->
  <!-- Divider line between columns -->
  <line x1="${scoreX}" y1="100" x2="${scoreX}" y2="540" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <text x="${scoreCenterX}" y="185" text-anchor="middle" font-family="${F}" font-size="120" font-weight="800" fill="${accent}">${typeof input.score === "number" ? Math.round(input.score) : "—"}</text>
  <text x="${scoreCenterX}" y="215" text-anchor="middle" font-family="${F}" font-size="32" fill="rgba(255,255,255,0.30)" font-weight="600">/100</text>

  <!-- Grade badge -->
  <rect x="${scoreCenterX - 85}" y="235" width="170" height="44" rx="12" fill="${badgeBg}" stroke="rgba(255,255,255,0.12)"/>
  <text x="${scoreCenterX}" y="264" text-anchor="middle" font-family="${F}" font-size="18" font-weight="800" fill="${badgeText}" letter-spacing="2">GRADE ${escapeXml(verdict.toUpperCase())}</text>

  ${durationSec > 0 ? `<text x="${scoreCenterX}" y="305" text-anchor="middle" font-family="${F}" font-size="12" font-weight="500" fill="rgba(255,255,255,0.30)">${agentCount} agents · ${durationSec.toFixed(1)}s</text>` : ""}

  <!-- QR code -->
  ${qr ? `<g transform="translate(${scoreCenterX - 85}, 325)">
    <rect x="0" y="0" width="170" height="170" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>
    <image href="${qr}" x="12" y="12" width="146" height="146"/>
    <text x="85" y="192" text-anchor="middle" font-family="${F}" font-size="10" font-weight="600" fill="rgba(255,255,255,0.40)">FULL SCAN RESULTS</text>
  </g>` : ""}

  <!-- KEY FINDINGS (bottom left) -->
  <text x="96" y="${agentBarsY + agents.length * agentRowH + 20}" font-family="${F}" font-size="12" font-weight="700" fill="rgba(255,255,255,0.40)" letter-spacing="1.5">KEY FINDINGS</text>
${bullets.map((b, i) => {
    const y = agentBarsY + agents.length * agentRowH + 42 + i * 24;
    return `  <circle cx="104" cy="${y - 4}" r="3" fill="${accent}" opacity="0.8"/>
  <text x="116" y="${y}" font-family="${F}" font-size="13" font-weight="500" fill="rgba(255,255,255,0.75)">${escapeXml(truncate(b, 65))}</text>`;
  }).join("\n")}

  <!-- Summary (if space allows) -->
  ${summary ? (() => {
    // Truncate at word boundary for cleaner summary
    let s = summary;
    if (s.length > 110) {
      s = s.slice(0, 110);
      const lastSpace = s.lastIndexOf(" ");
      if (lastSpace > 60) s = s.slice(0, lastSpace);
      s += "…";
    }
    const summaryY = Math.min(525, agentBarsY + agents.length * agentRowH + 42 + bullets.length * 24 + 25);
    return `<text x="96" y="${summaryY}" font-family="${F}" font-size="11" font-weight="500" fill="rgba(255,255,255,0.35)">${escapeXml(s)}</text>`;
  })() : ""}

  <!-- Branding bottom-left -->
  <text x="96" y="560" font-family="${F}" font-size="20" font-weight="800" letter-spacing="0.5">
    <tspan fill="#6B46C1">Verdict</tspan><tspan fill="#00D4AA">Swarm</tspan>
  </text>
  <text x="96" y="580" font-family="${F}" font-size="11" font-weight="500" fill="rgba(255,255,255,0.25)">AI-Powered Multi-Agent Token Analysis  ·  verdictswarm.io  ·  @VswarmAi</text>

</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
