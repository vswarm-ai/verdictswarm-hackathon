"use client";

import { useState } from "react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type ScanResult = any;

type Props = {
  onResult: (result: ScanResult | null) => void;
  onQuotaUpdate?: () => void;
};

type TokenPreview = {
  name: string;
  symbol: string;
  chainId?: number;
  chain?: string;
  chainName?: string;
};

function isEvmAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v.trim());
}

// Loose base58 check (Solana mints/programs are base58; most are 32-44 chars)
function isBase58Address(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());
}

function isSupportedAddress(v: string) {
  return isEvmAddress(v) || isBase58Address(v);
}

// Extract the first valid address from input (fixes double-paste / whitespace)
function extractAddress(input: string): string {
  const trimmed = input.trim();
  const evmMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return evmMatch[0];
  const solMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch) return solMatch[0];
  return trimmed;
}

export default function ScanForm({ onResult, onQuotaUpdate }: Props) {
  const [contractAddress, setContractAddress] = useState("");
  const [detected, setDetected] = useState<TokenPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setError(null);
    setLoading(true);
    try {
      const tRes = await fetch(`/api/token/${contractAddress.trim()}`);
      const tData = (await tRes.json().catch(() => ({}))) as any;
      if (!tRes.ok) throw new Error(tData?.error ?? "Token lookup failed");
      setDetected(tData);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: contractAddress.trim(),
          chainId: tData?.chainId,
          chain: tData?.chain,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Scan failed");
      }

      onResult(data.result);
      onQuotaUpdate?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="text-xs text-white/60">Token contract address</label>
          <Input
            value={contractAddress}
            // Defensive: prevent parent click handlers / accidental link wrappers
            // from intercepting the click and navigating away.
            onClick={(e) => {
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onChange={(e) => {
              const v = extractAddress(e.target.value);
              setContractAddress(v);
              setDetected(null);
              setError(null);
            }}
            placeholder="Paste contract address (0x… or Solana base58)"
            className="mt-1 font-mono"
          />
          {detected?.name && (
            <p className="mt-2 text-xs text-white/60">
              Detected: <span className="text-white/80">{detected.name}</span> ({detected.symbol})
              {" "}on <span className="text-white/80">{detected.chainName ?? detected.chain}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={loading || !isSupportedAddress(contractAddress)}
          onClick={() => runScan().catch((e) => setError(e?.message ?? String(e)))}
        >
          {loading ? "Scanning…" : "Scan"}
        </Button>
        {error && <p className="text-sm text-vs-error">{error}</p>}
      </div>
    </Card>
  );
}
