"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type TokenPreview = {
  name: string;
  symbol: string;
  chainName?: string;
  chainId?: number;
  chain?: string;
};

function isEvmAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

// Loose base58 check (Solana mints/programs are base58; most are 32-44 chars)
function isBase58Address(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function isSupportedAddress(v: string) {
  return isEvmAddress(v) || isBase58Address(v);
}

// Extract the first valid address from input (fixes double-paste bugs)
function extractAddress(input: string): string {
  const trimmed = input.trim();
  // Check for EVM address (0x + 40 hex chars)
  const evmMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return evmMatch[0];
  // Check for Solana base58 (32-44 chars, no 0x prefix)
  const solMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch) return solMatch[0];
  return trimmed;
}

export default function HeroSearch() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TokenPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchPreview(addr: string) {
    const res = await fetch(`/api/token/${addr}`);
    if (!res.ok) throw new Error((await res.json())?.error ?? "Token lookup failed");
    return (await res.json()) as TokenPreview;
  }

  async function runLookup(addr: string) {
    if (!isSupportedAddress(addr)) {
      setError("Please enter a valid contract address (EVM 0x… or Solana base58)");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const p = await fetchPreview(addr);
      setPreview(p);

      if (typeof p.chainId === "number") {
        router.push(`/scan/${addr}?chainId=${p.chainId}`);
      } else if (p.chain) {
        router.push(`/scan/${addr}?chain=${encodeURIComponent(p.chain)}`);
      } else {
        router.push(`/scan/${addr}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Token lookup failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="scan" className="pt-10">
      <div className="grid gap-6 md:grid-cols-12 md:items-center">
        <div className="md:col-span-7">
          <p className="text-xs tracking-widest text-white/60">VERDICTSWARM</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            Not just a tool — a community.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/70">
            Paste a token contract and get a single, explainable risk score — powered by specialized
            bots across security, socials, tokenomics, technicals, and adversarial critique. As the
            jury grows, you can share in that growth financially via staking rewards + token
            appreciation from protocol burns.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Input
                value={address}
                onChange={(e) => {
                  const v = extractAddress(e.target.value);
                  setAddress(v);
                  setError(null);
                  setPreview(null);
                }}
                onPaste={async (e) => {
                  e.preventDefault();
                  const v = extractAddress(e.clipboardData.getData("text"));
                  if (!isSupportedAddress(v)) return;
                  setAddress(v);
                  // Auto-navigate to scan on paste (no extra click needed)
                  runLookup(v);
                }}
                placeholder="Paste contract address (0x… or Solana base58)"
              />
            </div>

            <Button
              className="w-full sm:w-auto"
              disabled={!isSupportedAddress(address) || loading}
              onClick={() => runLookup(address)}
            >
              {loading ? "Detecting…" : "Scan →"}
            </Button>
          </div>

          <p className="mt-3 text-sm text-white/55">
            Auto-detects: Ethereum, Base, Arbitrum, Polygon, BSC, Avalanche, Solana (and more when
            available).
          </p>

          {preview && (
            <p className="mt-4 text-sm text-white/70">
              Scanning <span className="font-semibold text-white">{preview.name}</span> (
              <span className="font-mono text-white">{preview.symbol}</span>) on{" "}
              <span className="text-white">{preview.chainName ?? preview.chain ?? "Unknown"}</span>
            </p>
          )}

          {error && <p className="mt-4 text-sm text-vs-error">{error}</p>}
        </div>

        <div className="md:col-span-5">
          <Card className="p-6">
            <p className="text-sm font-medium">What you get</p>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-vs-cyan" />
                <span>Overall 0–10 verdict + LOW_RISK / PROCEED WITH CAUTION / HIGH RISK — FLAGGED label</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-vs-purple" />
                <span>Per-bot breakdown with expandable evidence and flags</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/40" />
                <span>Shareable report link (great for communities & teams)</span>
              </li>
            </ul>

            <div className="mt-6 rounded-xl border border-vs-border bg-black/20 p-4">
              <p className="text-xs text-white/60">Aligned incentives</p>
              <p className="mt-1 text-sm text-white/75">
                Upgrade to Pro for full adversarial consensus — 6 specialized agents analyze and debate to deliver
                scarcity.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
