"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ─── Helpers ─── */

function isEvmAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

function isBase58Address(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function isSupportedAddress(v: string) {
  return isEvmAddress(v) || isBase58Address(v);
}

function extractAddress(input: string): string {
  const trimmed = input.trim();
  const evmMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return evmMatch[0];
  const solMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch) return solMatch[0];
  return trimmed;
}

/* ─── Grade Badge Component ─── */

function GradeBadge({ grade }: { grade: string }) {
  let color = "text-[#00D4AA] border-[#00D4AA]/40 bg-[#00D4AA]/10";
  if (grade.startsWith("B") || grade.startsWith("C"))
    color = "text-[#FFD700] border-[#FFD700]/40 bg-[#FFD700]/10";
  if (grade === "D" || grade === "F")
    color = "text-[#FF0055] border-[#FF0055]/40 bg-[#FF0055]/10";

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-bold border ${color}`}
    >
      {grade}
    </span>
  );
}

/* ─── Live Scans Ticker Data ─── */

const LIVE_SCANS = [
  { ticker: "$PEPE", grade: "B" },
  { ticker: "$INJ", grade: "C" },
  { ticker: "$LINK", grade: "A-" },
  { ticker: "$UNI", grade: "B+" },
  { ticker: "$ARB", grade: "B" },
  { ticker: "$DOGE", grade: "B+" },
  { ticker: "$AAVE", grade: "A" },
  { ticker: "$MATIC", grade: "B" },
];

/* ─── Hexagon Background ─── */

function HexBg() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,15 58,37 30,50 2,37 2,15' fill='none' stroke='%236B46C1' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "60px 52px",
      }}
    />
  );
}

/* ─── dApp Home Page ─── */

export default function DAppHomePage() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(
    async (addr: string) => {
      const clean = extractAddress(addr);
      if (!isSupportedAddress(clean)) {
        setError("Not a valid token address");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Auto-detect Solana vs EVM
        const params = new URLSearchParams();
        if (isBase58Address(clean) && !isEvmAddress(clean)) {
          // Solana address detected
          params.set("chain", "solana");
          router.push(`/scan/${clean}?${params.toString()}`);
        } else {
          // EVM address — lookup chain
          const res = await fetch(`/api/token/${clean}`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              (body as { error?: string })?.error ?? "Token lookup failed",
            );
          }
          const t = (await res.json()) as {
            chainId?: number;
            chain?: string;
          };

          if (typeof t.chainId === "number") params.set("chainId", String(t.chainId));
          else if (t.chain) params.set("chain", t.chain);

          const qs = params.toString();
          router.push(`/scan/${clean}${qs ? `?${qs}` : ""}`);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Token lookup failed");
        setLoading(false);
      }
    },
    [router],
  );

  return (
    <main className="relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center">
      <HexBg />

      {/* Radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[500px] rounded-full bg-[#6B46C1]/10 blur-[120px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex w-full flex-col items-center px-4">
        {/* Input Row */}
        <div className="flex w-full max-w-[700px] items-center gap-3">
          {/* Input Field */}
          <div className="relative flex-1">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                const v = extractAddress(e.target.value);
                setAddress(v);
                setError(null);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const v = extractAddress(e.clipboardData.getData("text"));
                if (!isSupportedAddress(v)) return;
                setAddress(v);
                handleScan(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScan(address);
              }}
              placeholder="Paste contract address (0x… or Solana base58)"
              className="h-16 w-full rounded-xl border border-[#6B46C1]/30 bg-[#13131F]/80 px-6 text-lg text-white placeholder:text-white/35 outline-none backdrop-blur-sm transition focus:border-[#00D4AA]/50 focus:shadow-[0_0_20px_rgba(0,212,170,0.15)]"
              style={{ fontFamily: "var(--font-mono)" }}
              disabled={loading}
            />
            {/* Chain icon when address detected */}
            {address && isSupportedAddress(address) && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isEvmAddress(address) && (
                  <div className="h-7 w-7 rounded-full bg-[#627EEA]/20 border border-[#627EEA]/30 flex items-center justify-center text-xs" title="EVM Token Detected">
                    ⟠
                  </div>
                )}
                {isBase58Address(address) && !isEvmAddress(address) && (
                  <div className="h-7 w-7 rounded-full bg-[#9945FF]/20 border border-[#9945FF]/30 flex items-center justify-center text-xs" title="Solana Token Detected">
                    ◎
                  </div>
                )}
                <span className="text-[10px] text-white/30 font-mono">✓</span>
              </div>
            )}
          </div>

          {/* Hexagonal Scan Button */}
          <button
            onClick={() => handleScan(address)}
            disabled={!isSupportedAddress(address) || loading}
            className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Scan token"
          >
            <div
              className="absolute inset-0 hex-clip transition-all"
              style={{
                background: "linear-gradient(135deg, #00D4AA, #00D4FF)",
                boxShadow: loading
                  ? "0 0 30px rgba(0,212,170,0.6)"
                  : "0 0 15px rgba(0,212,170,0.3)",
              }}
            />
            <span className="relative z-10 font-orbitron text-sm font-bold text-black">
              {loading ? "..." : "Scan"}
            </span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 rounded-lg border border-[#FF0055]/30 bg-[#FF0055]/10 px-4 py-2 text-sm text-[#FF0055]">
            {error}
            {error === "Not a valid token address" && (
              <span className="ml-2 text-white/50">Try pasting from a block explorer</span>
            )}
          </div>
        )}

        {/* Tagline */}
        <p className="font-orbitron mt-6 text-xl font-bold tracking-wider text-white/90 md:text-2xl">
          Unleash the Swarm.
        </p>
      </div>

      {/* Live Scans Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="border-t border-[#2D2D3A]/60 bg-[#13131F]/90 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-white/70">Live Scans</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D4AA]/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D4AA]" />
              </span>
            </div>
            <div className="overflow-hidden">
              <div className="animate-ticker flex whitespace-nowrap">
                {[...LIVE_SCANS, ...LIVE_SCANS].map((item, i) => (
                  <span
                    key={i}
                    className="mx-4 inline-flex items-center gap-2 text-sm"
                  >
                    <span className="font-mono-jb font-bold text-white/90">
                      {item.ticker}
                    </span>
                    <GradeBadge grade={item.grade} />
                    <span className="text-white/20">//</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
