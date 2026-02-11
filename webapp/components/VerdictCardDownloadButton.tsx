"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";

type Props = {
  tokenName: string;
  tokenSymbol?: string | null;
  verdict: string;
  score?: number | null;
  findings: string[];
  reportUrl?: string;
};

async function svgToPngBlob(svgText: string, width: number, height: number): Promise<Blob> {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // Background (in case SVG transparency)
    ctx.fillStyle = "#050608";
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Failed to export PNG");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function VerdictCardDownloadButton({ tokenName, tokenSymbol, verdict, score, findings, reportUrl }: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="secondary"
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          const res = await fetch("/api/verdict-card", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              tokenName,
              tokenSymbol: tokenSymbol ?? undefined,
              verdict,
              score: typeof score === "number" ? score : undefined,
              findings,
              reportUrl,
            }),
          });

          if (!res.ok) {
            const raw = await res.text();
            let msg = "Failed to generate verdict card";
            try {
              msg = (JSON.parse(raw) as { error?: string })?.error ?? msg;
            } catch {
              // ignore
            }
            throw new Error(msg);
          }

          const svg = await res.text();
          const png = await svgToPngBlob(svg, 1200, 630);

          const href = URL.createObjectURL(png);
          const a = document.createElement("a");
          a.href = href;
          a.download = `${(tokenSymbol || tokenName || "verdict").toString().replaceAll(/\s+/g, "-")}-verdict-card.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Download failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Preparing…" : "📥 Download Verdict Card"}
    </Button>
  );
}
