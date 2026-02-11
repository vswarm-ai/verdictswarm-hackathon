"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";

type Props = {
  tokenName: string;
  tokenSymbol?: string | null;
  verdict: string;
  score?: number | null;
  keyFindings?: string[];
};

function TwitterXIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M18.244 2H21.55l-7.227 8.26L22.83 22h-6.61l-5.18-6.788L4.99 22H1.68l7.73-8.835L1.17 2h6.78l4.68 6.231L18.244 2Zm-1.16 18h1.83L6.86 3.93H4.9L17.084 20Z"
      />
    </svg>
  );
}

export default function ShareButton({ tokenName, tokenSymbol, verdict, score, keyFindings }: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="secondary"
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);

          const res = await fetch("/api/share/image", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token_name: tokenName,
              token_symbol: tokenSymbol ?? undefined,
              verdict,
              score: typeof score === "number" ? score : undefined,
              key_findings: Array.isArray(keyFindings) ? keyFindings : [],
            }),
          });

          if (!res.ok) {
            const raw = await res.text();
            let msg = "Failed to generate share image";
            try {
              msg = (JSON.parse(raw) as { error?: string })?.error ?? msg;
            } catch {
              // ignore
            }
            throw new Error(msg);
          }

          const blob = await res.blob();
          const file = new File([blob], "verdictswarm.png", { type: "image/png" });

          const text = `I just scanned ${tokenSymbol ? `$${tokenSymbol}` : tokenName} with @VswarmAi\n\nVerdict: ${verdict} ⚖️\n\nverdictswarm.io`;

          // Best-effort: use Web Share API with files (mobile supports image attach).
          // If not available, fall back to X intent with text only and download the image.
          const nav = navigator as Navigator & {
            canShare?: (data?: ShareData) => boolean;
            share?: (data?: ShareData) => Promise<void>;
          };

          const canShareFiles =
            typeof navigator !== "undefined" &&
            typeof nav.share === "function" &&
            typeof nav.canShare === "function" &&
            nav.canShare({ files: [file] });

          if (canShareFiles) {
            await nav.share({ text, files: [file], title: "VerdictSwarm scan" });
            return;
          }

          // Fallback: trigger download so user can attach manually, and open intent with text.
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = "verdictswarm-share.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);

          const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
          window.open(intent, "_blank", "noopener,noreferrer");
        } catch (e) {
          alert(e instanceof Error ? e.message : "Share failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      <span className="inline-flex items-center gap-2">
        <TwitterXIcon className="h-4 w-4" />
        {loading ? "Preparing…" : "Share on X"}
      </span>
    </Button>
  );
}
