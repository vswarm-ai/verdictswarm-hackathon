"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type BotResult = {
  bot: string;
  score: number;
  summary: string;
  details: string[];
  flags: string[];
};

type ScanResult = {
  address: string;
  chainId?: number;
  chain?: string;
  overall: number;
  bots: BotResult[];
};

function labelFor(score: number) {
  if (score >= 8) return { text: "LOW_RISK", color: "text-vs-success" };
  if (score >= 5) return { text: "PROCEED WITH CAUTION", color: "text-vs-warning" };
  return { text: "HIGH RISK — FLAGGED", color: "text-vs-error" };
}

export default function ScanResults({ result }: { result: ScanResult | null }) {
  if (!result) {
    return (
      <Card className="p-6">
        <p className="text-sm text-white/60">Run a scan to see results.</p>
      </Card>
    );
  }

  const verdict = labelFor(result.overall);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest text-white/55">LATEST RESULT</p>
          <p className="mt-2 text-sm text-white/70">
            Contract: <span className="font-mono text-white/85">{result.address}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-center">
          <div className={`text-xs font-semibold ${verdict.color}`}>{verdict.text}</div>
          <div className="mt-1 text-3xl font-semibold">{result.overall.toFixed(1)}</div>
          <div className="mt-1 text-xs text-white/50">Overall score</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {result.bots.map((b) => (
          <div key={b.bot} className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{b.bot}</p>
                <p className="mt-1 text-sm text-white/70">{b.summary}</p>
              </div>
              <p className="text-xl font-semibold">{b.score.toFixed(1)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button
          variant="secondary"
          onClick={() => {
            const qp =
              typeof result.chainId === "number"
                ? `?chainId=${result.chainId}`
                : result.chain
                  ? `?chain=${encodeURIComponent(result.chain)}`
                  : "";
            const url = `${window.location.origin}/scan/${result.address}${qp}`;
            navigator.clipboard?.writeText(url).catch(() => {});
          }}
        >
          Copy report link
        </Button>
      </div>
    </Card>
  );
}
