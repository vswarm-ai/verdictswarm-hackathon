"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Row = {
  rank: number;
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
  score?: number;
  reportHref?: string;
};

function fmtUsd(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1 ? 2 : 6,
  });
}

export default function Top100Table() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/top100");
        if (!res.ok) throw new Error("Failed to load top 100");
        const data = (await res.json()) as Row[];
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const body = useMemo(() => {
    if (error) return <p className="text-sm text-vs-error">{error}</p>;
    if (!rows)
      return <p className="text-sm text-white/60">Loading market data…</p>;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-vs-border/80 text-xs text-white/55">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">24h</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const changeColor = r.change24h >= 0 ? "text-vs-success" : "text-vs-error";
              return (
                <tr key={r.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-4 text-white/60">{r.rank}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.image} alt={r.name} className="h-7 w-7 rounded-full" />
                      <div className="leading-tight">
                        <div className="font-medium text-white">{r.name}</div>
                        <div className="text-xs text-white/50">{r.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-white/80">{fmtUsd(r.price)}</td>
                  <td className={`px-4 py-4 ${changeColor}`}>{r.change24h.toFixed(2)}%</td>
                  <td className="px-4 py-4">
                    {typeof r.score === "number" ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs">
                        <span className="h-2 w-2 rounded-full bg-vs-success" />
                        {r.score.toFixed(1)}/10
                      </span>
                    ) : (
                      <span className="text-white/40">⏳ --/10</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {r.reportHref ? (
                      <Link href={r.reportHref}>
                        <Button size="sm" variant="secondary">
                          View Report
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          // No contract mapping yet; this is a CTA placeholder.
                          window.location.hash = "#scan";
                        }}
                      >
                        Run Scan →
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [rows, error]);

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">📊 Top 100 by Market Cap</h2>
          <p className="mt-1 text-sm text-white/55">Daily auto-updated (CoinGecko)</p>
        </div>
      </div>

      <Card className="mt-4 p-0">
        <div className="p-4">{body}</div>
      </Card>
    </section>
  );
}
