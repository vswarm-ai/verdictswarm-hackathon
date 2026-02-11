import QRCode from "qrcode";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";

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

async function qrPngBytes(url: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, scale: 6 });
  const b64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

const LETTER: [number, number] = [612, 792];

const COLORS = {
  bg: rgb(0.043, 0.059, 0.098),
  card: rgb(0.067, 0.094, 0.161),
  border: rgb(0.141, 0.192, 0.275),
  text: rgb(0.898, 0.906, 0.922),
  sub: rgb(0.612, 0.639, 0.686),
  cyan: rgb(0.133, 0.827, 0.933),
  purple: rgb(0.655, 0.545, 0.98),
  pink: rgb(0.984, 0.443, 0.522),
  good: rgb(0.204, 0.827, 0.6),
  warn: rgb(0.984, 0.749, 0.141),
  bad: rgb(0.973, 0.443, 0.443),
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
};

type Layout = {
  margin: number;
  contentWidth: number;
  pageWidth: number;
  pageHeight: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function drawText(page: PDFPage, text: string, opts: { x: number; y: number; size: number; font: PDFFont; color: RGB; maxWidth?: number; lineHeight?: number }) {
  const { x, y, size, font, color, maxWidth, lineHeight } = opts;
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
    maxWidth,
    lineHeight: lineHeight ?? size * 1.2,
  });
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = (text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // If single word is too long, hard split by characters
    if (font.widthOfTextAtSize(w, fontSize) > maxWidth) {
      let chunk = "";
      for (const ch of w) {
        const cand2 = chunk + ch;
        if (font.widthOfTextAtSize(cand2, fontSize) <= maxWidth) {
          chunk = cand2;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      line = chunk;
    } else {
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(page: PDFPage, text: string, opts: { x: number; y: number; font: PDFFont; size: number; color: RGB; maxWidth: number; lineHeight?: number }) {
  const { x, y, font, size, color, maxWidth } = opts;
  const lh = opts.lineHeight ?? size * 1.25;
  const lines = wrapLines(text, font, size, maxWidth);
  let cy = y;
  for (const line of lines) {
    drawText(page, line, { x, y: cy, size, font, color, maxWidth });
    cy -= lh;
  }
  return { height: lines.length * lh, lines };
}

function drawCenteredText(page: PDFPage, text: string, opts: { x: number; y: number; width: number; size: number; font: PDFFont; color: RGB }) {
  const textWidth = opts.font.widthOfTextAtSize(text, opts.size);
  const cx = opts.x + (opts.width - textWidth) / 2;
  drawText(page, text, { x: cx, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
}

function ensurePage(pdfDoc: PDFDocument, state: { page: PDFPage; y: number }, needed: number, layout: Layout, watermarkFn: (p: PDFPage) => void, footerFn: (p: PDFPage) => void) {
  if (state.y - needed >= layout.margin) return;
  watermarkFn(state.page);
  footerFn(state.page);
  state.page = pdfDoc.addPage(LETTER);
  state.y = layout.pageHeight - layout.margin;
}

export async function renderPdfReport(data: PdfReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("VerdictSwarm Report");

  const pageWidth = LETTER[0];
  const pageHeight = LETTER[1];
  const margin = 48;
  const layout: Layout = {
    margin,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - margin * 2,
  };

  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  const isFree = data.tierKey === "FREE";

  let page = pdfDoc.addPage(LETTER);
  const state = { page, y: pageHeight - margin };

  const watermark = (p: PDFPage) => {
    if (!isFree) return;
    const text = "FREE TIER REPORT — Full analysis at verdictswarm.io";
    // pdf-lib doesn't have a page-wide opacity setter; use color alpha instead.
    p.drawText(text, {
      x: margin,
      y: pageHeight / 2,
      size: 28,
      font: fonts.bold,
      color: rgb(1, 1, 1),
      opacity: 0.08,
      rotate: degrees(-20),
      maxWidth: pageWidth - margin * 2,
    });
  };

  const footer = (p: PDFPage) => {
    const y = margin * 0.55;
    const text = "Scanned by VerdictSwarm";
    drawCenteredText(p, text, { x: margin, y, width: layout.contentWidth, size: 9, font: fonts.regular, color: COLORS.sub });
  };

  const header = () => {
    // Title line
    drawText(state.page, "VerdictSwarm", { x: margin, y: state.y, size: 18, font: fonts.bold, color: COLORS.text });
    const subtitleX = margin + fonts.bold.widthOfTextAtSize("VerdictSwarm", 18) + 10;
    drawText(state.page, "•  PDF scan report", { x: subtitleX, y: state.y + 2, size: 10, font: fonts.regular, color: COLORS.sub });
    state.y -= 22;

    drawText(state.page, `Generated: ${new Date(data.createdAtIso).toLocaleString("en-US")}`, {
      x: margin,
      y: state.y,
      size: 9,
      font: fonts.regular,
      color: COLORS.sub,
    });
    state.y -= 14;

    drawText(state.page, `Token: ${data.tokenName ?? "Unknown"} (${data.tokenSymbol ?? "—"})   •   Chain: ${data.chain}`, {
      x: margin,
      y: state.y,
      size: 9,
      font: fonts.regular,
      color: COLORS.sub,
      maxWidth: layout.contentWidth,
    });
    state.y -= 14;

    drawText(state.page, `Contract: ${data.address}`, {
      x: margin,
      y: state.y,
      size: 9,
      font: fonts.regular,
      color: COLORS.sub,
      maxWidth: layout.contentWidth,
    });
    state.y -= 22;
  };

  const verdictCard = () => {
    const w = layout.contentWidth;
    const h = 130;
    const x = margin;
    const yTop = state.y;
    const y = yTop - h;

    state.page.drawRectangle({ x, y, width: w, height: h, color: COLORS.card, borderColor: COLORS.border, borderWidth: 1 });

    const verdict = data.verdictLabel ?? "VERDICT";
    const score = typeof data.overallScore === "number" ? data.overallScore : undefined;
    const verdictColor = score === undefined ? COLORS.sub : score >= 8 ? COLORS.good : score >= 5 ? COLORS.warn : COLORS.bad;

    drawText(state.page, verdict, { x: x + 18, y: yTop - 46, size: 34, font: fonts.bold, color: verdictColor, maxWidth: w - 36 });

    drawText(state.page, score !== undefined ? score.toFixed(1) : "—", {
      x: x + 18,
      y: yTop - 98,
      size: 42,
      font: fonts.bold,
      color: COLORS.text,
      maxWidth: 140,
    });

    drawText(state.page, "Overall score (0–10)", { x: x + 18, y: yTop - 122, size: 10, font: fonts.regular, color: COLORS.sub, maxWidth: 160 });

    const badge = isFree ? "FREE TIER" : "PAID TIER";
    const badgeWidth = 120;
    const badgeX = x + w - badgeWidth - 18;
    drawText(state.page, badge, {
      x: badgeX,
      y: yTop - 34,
      size: 10,
      font: fonts.bold,
      color: isFree ? COLORS.pink : COLORS.cyan,
      maxWidth: badgeWidth,
    });

    state.y -= h + 26;
  };

  const vitalsRow = () => {
    const v = data.vitals ?? {};

    ensurePage(pdfDoc, state, 90, layout, watermark, footer);

    drawText(state.page, "Basic vitals", { x: margin, y: state.y, size: 12, font: fonts.bold, color: COLORS.text });
    state.y -= 20;

    const items: Array<[string, string]> = [
      ["Contract verified", yesNo(v.contractVerified)],
      ["Age", typeof v.ageDays === "number" ? `${v.ageDays}d` : "—"],
      ["Liquidity", money(v.liquidityUsd)],
      ["Holders", typeof v.holderCount === "number" ? new Intl.NumberFormat("en-US").format(v.holderCount) : "—"],
    ];

    const colW = layout.contentWidth / 4;
    const rowTop = state.y;

    items.forEach(([k, val], i) => {
      const x = margin + i * colW;
      drawText(state.page, k, { x, y: rowTop, size: 9, font: fonts.regular, color: COLORS.sub, maxWidth: colW - 6 });
      drawText(state.page, val, { x, y: rowTop - 16, size: 12, font: fonts.bold, color: COLORS.text, maxWidth: colW - 6 });
    });

    state.y -= 52;
  };

  const riskPreviewOrFull = () => {
    const risks = data.risks ?? [];
    const count = risks.length;

    ensurePage(pdfDoc, state, 120, layout, watermark, footer);

    drawText(state.page, isFree ? "Risk preview" : "Risks & flags", { x: margin, y: state.y, size: 12, font: fonts.bold, color: COLORS.text });
    state.y -= 18;

    if (count === 0) {
      drawText(state.page, "No critical risks detected.", { x: margin, y: state.y, size: 10, font: fonts.regular, color: COLORS.sub });
      state.y -= 22;
      return;
    }

    drawText(state.page, `${count} risk${count === 1 ? "" : "s"} found`, {
      x: margin,
      y: state.y,
      size: 11,
      font: fonts.bold,
      color: isFree ? COLORS.warn : COLORS.bad,
    });
    state.y -= 18;

    const shown = isFree ? risks.slice(0, 2) : risks;

    for (const r of shown) {
      ensurePage(pdfDoc, state, 90, layout, watermark, footer);

      drawText(state.page, `• ${r.title}`, { x: margin, y: state.y, size: 10, font: fonts.bold, color: COLORS.text, maxWidth: layout.contentWidth });
      state.y -= 14;

      if (!isFree && r.details) {
        const para = drawParagraph(state.page, r.details, {
          x: margin + 10,
          y: state.y,
          font: fonts.regular,
          size: 9,
          color: COLORS.sub,
          maxWidth: layout.contentWidth - 10,
        });
        state.y -= para.height + 4;
      }

      if (!isFree && r.codeSnippet) {
        const snippet = drawParagraph(state.page, r.codeSnippet, {
          x: margin + 14,
          y: state.y,
          font: fonts.mono,
          size: 8,
          color: rgb(0.82, 0.835, 0.86),
          maxWidth: layout.contentWidth - 14,
          lineHeight: 10,
        });
        state.y -= snippet.height + 6;
      }

      if (isFree) {
        drawText(state.page, "Details locked — upgrade to unlock.", { x: margin + 10, y: state.y, size: 9, font: fonts.regular, color: COLORS.sub, maxWidth: layout.contentWidth - 10 });
        state.y -= 16;
      }

      state.y -= 6;
    }

    if (isFree && count > shown.length) {
      drawText(state.page, "(additional risks hidden)", { x: margin, y: state.y, size: 9, font: fonts.regular, color: COLORS.sub });
      state.y -= 18;
    }

    state.y -= 6;
  };

  const freeLockedChecks = () => {
    const total = data.checksTotal ?? 34;
    const included = data.checksIncluded ?? 4;

    ensurePage(pdfDoc, state, 300, layout, watermark, footer);

    drawText(state.page, "Checks", { x: margin, y: state.y, size: 12, font: fonts.bold, color: COLORS.text });
    state.y -= 18;
    drawText(state.page, `${included} of ${total} checks included`, { x: margin, y: state.y, size: 10, font: fonts.regular, color: COLORS.sub });
    state.y -= 22;

    const lockedChecks = [
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
    ].slice(0, 34);

    const colCount = 2;
    const colW = layout.contentWidth / colCount;
    const rowH = 16;

    // Embed a font that supports the lock glyph. Standard fonts do not; use "[LOCK]" as fallback.
    const lockPrefix = "[LOCK] ";

    const startY = state.y;
    for (let idx = 0; idx < lockedChecks.length; idx++) {
      const col = idx % colCount;
      const row = Math.floor(idx / colCount);
      const x = margin + col * colW;
      const y = startY - row * rowH;

      // simple pagination if too long
      if (y < margin + 40) {
        watermark(state.page);
        footer(state.page);
        state.page = pdfDoc.addPage(LETTER);
        state.y = pageHeight - margin;
        // restart table on new page
        return freeLockedChecks();
      }

      drawText(state.page, `${lockPrefix}${lockedChecks[idx]}`, { x, y, size: 9, font: fonts.regular, color: COLORS.sub, maxWidth: colW - 8 });
    }

    const rows = Math.ceil(lockedChecks.length / colCount);
    state.y = startY - rows * rowH - 14;
  };

  const upgradeCta = async () => {
    if (!isFree) return;

    const upgradeUrl = `https://verdictswarm.io/upgrade?address=${encodeURIComponent(data.address)}&chain=${encodeURIComponent(data.chain)}`;

    let pngBytes: Uint8Array | null = null;
    try {
      pngBytes = await qrPngBytes(upgradeUrl);
    } catch (err) {
      console.error("[pdf] QR generation failed", {
        upgradeUrl,
        err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
      });
    }

    ensurePage(pdfDoc, state, 190, layout, watermark, footer);

    drawText(state.page, "Unlock the full report", { x: margin, y: state.y, size: 12, font: fonts.bold, color: COLORS.text });
    state.y -= 18;
    drawText(state.page, "Scan the QR to upgrade and download the full analysis.", { x: margin, y: state.y, size: 10, font: fonts.regular, color: COLORS.sub });
    state.y -= 14;

    const imgSize = 120;
    const imgX = margin;
    const imgY = state.y - imgSize - 8;

    if (pngBytes) {
      const img = await pdfDoc.embedPng(pngBytes);
      state.page.drawImage(img, { x: imgX, y: imgY, width: imgSize, height: imgSize });
    }

    const urlX = imgX + imgSize + 20;
    drawParagraph(state.page, upgradeUrl, {
      x: urlX,
      y: state.y - 12,
      font: fonts.regular,
      size: 9,
      color: COLORS.sub,
      maxWidth: margin + layout.contentWidth - urlX,
      lineHeight: 11,
    });

    state.y = imgY - 26;
  };

  const paidBotAnalyses = () => {
    if (isFree) return;

    const bots = data.bots ?? [];

    ensurePage(pdfDoc, state, 80, layout, watermark, footer);

    drawText(state.page, "Bot analyses", { x: margin, y: state.y, size: 12, font: fonts.bold, color: COLORS.text });
    state.y -= 22;

    for (const b of bots) {
      ensurePage(pdfDoc, state, 130, layout, watermark, footer);

      // Emojis may not render with standard fonts; keep them but don't rely on them.
      drawText(state.page, `${b.emoji ?? ""} ${b.name}`.trim(), {
        x: margin,
        y: state.y,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: layout.contentWidth,
      });
      state.y -= 16;

      const meta = [b.model ? `Model: ${b.model}` : null, typeof b.score === "number" ? `Score: ${b.score.toFixed(1)}` : null]
        .filter(Boolean)
        .join("   •   ");

      if (meta) {
        drawText(state.page, meta, { x: margin, y: state.y, size: 9, font: fonts.regular, color: COLORS.sub, maxWidth: layout.contentWidth });
        state.y -= 14;
      }

      if (b.summary) {
        const para = drawParagraph(state.page, b.summary, {
          x: margin,
          y: state.y,
          font: fonts.regular,
          size: 10,
          color: COLORS.sub,
          maxWidth: layout.contentWidth,
        });
        state.y -= para.height + 6;
      }

      const details = (b.details ?? []).slice(0, 8);
      for (const d of details) {
        const para = drawParagraph(state.page, `• ${d}`, {
          x: margin + 10,
          y: state.y,
          font: fonts.regular,
          size: 9,
          color: COLORS.sub,
          maxWidth: layout.contentWidth - 10,
          lineHeight: 11,
        });
        state.y -= para.height;
      }

      state.y -= 14;
    }
  };

  // Render
  header();
  verdictCard();
  vitalsRow();
  riskPreviewOrFull();
  if (isFree) freeLockedChecks();
  await upgradeCta();
  paidBotAnalyses();

  // Stamp watermark + footer on last page (also handled on pagination)
  watermark(state.page);
  footer(state.page);

  const out = await pdfDoc.save();

  // Defensive: in some Next.js/turbopack/server bundling scenarios we have seen
  // `save()` come back as an unexpected object (e.g. a PDFDocument) which will
  // crash Buffer.from with: "Received an instance of PDFDocument".
  // Normalize to a Buffer for downstream NextResponse usage.
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out && (out as any) instanceof ArrayBuffer) return Buffer.from(new Uint8Array(out as ArrayBuffer));

  // Last resort: some runtimes may hand back a base64 string.
  if (typeof out === "string") return Buffer.from(out, "base64");

  console.error("[pdf] Unexpected pdfDoc.save() return type", {
    type: typeof out,
    ctor: (out as any)?.constructor?.name,
    keys: out && typeof out === "object" ? Object.keys(out as any).slice(0, 20) : undefined,
  });
  throw new TypeError("Unexpected return type from pdfDoc.save()");
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
