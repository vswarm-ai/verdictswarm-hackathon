"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "@/components/ui/Card";
import SwarmScanOverlay from "@/components/SwarmScanOverlay";
import ProgressToTier from "@/components/ProgressToTier";
import Button from "@/components/ui/Button";
import ShareButton from "@/components/ShareButton";
import VerdictCardDownloadButton from "@/components/VerdictCardDownloadButton";
import LockedTierCard from "@/components/LockedTierCard";
import { PerVerdictDisclaimer } from "@/components/LegalDisclaimers";

import type { TierKey } from "@/lib/tier";

type QuotaInfo = {
  address: string;
  tier: string;
  used: number;
  remaining: number;
  limit: number;
};

type BotCatalogEntry = {
  key: string;
  name: string;
  emoji: string;
  modelLabel: string;
  unlockTier: TierKey;
};

// Canonical bot + model mapping for the scan page.
const BOT_CATALOG: BotCatalogEntry[] = [
  // FREE tier = regex-only checks. No AI.
  { key: "ScamBot", name: "The Prosecutor", emoji: "🧪", modelLabel: "Regex (no AI)", unlockTier: "FREE" },

  // TIER_1+ basic swarm bots (entry-level models)
  {
    key: "TechnicianBot",
    name: "The Technician",
    emoji: "📊",
    modelLabel: "GPT-4o Mini (OpenAI)",
    unlockTier: "TIER_1",
  },
  {
    key: "SecurityBot",
    name: "The Investigator",
    emoji: "🔒",
    modelLabel: "Claude 3 Haiku (Anthropic)",
    unlockTier: "TIER_1",
  },
  {
    key: "TokenomicsBot",
    name: "The Economist",
    emoji: "💰",
    modelLabel: "Gemini 2.5 Flash (Google)",
    unlockTier: "TIER_1",
  },
  { key: "SocialBot", name: "The Witness", emoji: "🐦", modelLabel: "Grok 3 (xAI)", unlockTier: "TIER_1" },

  // TIER_1 — Devil's Advocate (peer review of other agents)
  {
    key: "DevilsAdvocate",
    name: "Devil's Advocate",
    emoji: "😈",
    modelLabel: "Gemini 2.5 Flash (Google)",
    unlockTier: "TIER_1",
  },

  // TIER_2 upgraded model(s)
  { key: "MacroBot", name: "The Advisor", emoji: "🌍", modelLabel: "Gemini 2.5 Flash (Google)", unlockTier: "TIER_1" },
  { key: "VisionBot", name: "The Observer", emoji: "👁️", modelLabel: "Gemini 3 Pro (vision)", unlockTier: "TIER_2" },
];

const TIER_COPY: Record<TierKey, { name: string; label: string; perks: string[] }> = {
  FREE: {
    name: "Scout",
    label: "FREE",
    perks: ["2 AI agents (Technician + Security)", "Scam & honeypot detection", "3 scans/day"],
  },
  TIER_1: {
    name: "Investigator",
    label: "TIER 1 · PRO",
    perks: ["Multi-model AI (GPT-4o, Claude, Gemini, Grok)", "All basic bots enabled", "15 scans/day"],
  },
  TIER_2: {
    name: "Prosecutor",
    label: "TIER 2 · PRO+",
    perks: [
      "Upgraded AI (Gemini 3 Pro)",
      "+ VisionBot (screenshot analysis)",
      "+ API access for bot integrations",
      "20 scans/day",
    ],
  },
  TIER_3: {
    name: "Grand Jury",
    label: "TIER 3 · PREMIUM",
    perks: ["Top AI versions (Gemini 3 Pro, Grok 4)", "+ Real-time alerts", "+ Priority queue", "50 scans/day"],
  },
  SWARM_DEBATE: {
    name: "Consensus",
    label: "CONSENSUS · ULTIMATE",
    perks: [
      "ALL models (Gemini, Grok, Kimi, Codex)",
      "Up to 20+ specialized agents",
      "Different AI for each function (multiple perspectives)",
      "Full debate until consensus reached",
      "5 debates/day",
    ],
  },
};

function tierRank(key: TierKey): number {
  switch (key) {
    case "FREE":
      return 0;
    case "TIER_1":
      return 1;
    case "TIER_2":
      return 2;
    case "TIER_3":
      return 3;
    case "SWARM_DEBATE":
      return 4;
  }
}

type BotResult = {
  bot: string;
  model?: string;
  score: number;
  summary: string;
  details: string[];
  flags: string[];
};

type TokenPreview = {
  name: string;
  symbol: string;
  chainId?: number;
  chain?: string;
  chainName?: string;
};

type FreeTierChecks = Record<string, unknown>;

type ScanResult = {
  address: string;
  chainId?: number;
  chain?: string;
  overall: number;
  bots: BotResult[];
  flags?: string[];
  // FREE tier payload (from SSE)
  free_tier?: boolean;
  ft_verdict?: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
  ft_reason?: string;
  ft_label?: string | null;
  ft_checks?: FreeTierChecks;
};

function labelFor(score: number) {
  if (score >= 8) return { text: "LOW_RISK", color: "text-vs-success" };
  if (score >= 5) return { text: "PROCEED WITH CAUTION", color: "text-vs-warning" };
  return { text: "HIGH RISK — FLAGGED", color: "text-vs-error" };
}

function PdfDownloadButton({
  address,
  chain,
  tierKey,
  score,
  riskCount,
}: {
  address: string;
  chain: string;
  tierKey: TierKey;
  score: number;
  riskCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const label = tierKey === "FREE" ? "Download Free Report" : "Download Full Report";

  return (
    <Button
      variant={tierKey === "FREE" ? "secondary" : "primary"}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          const url = `/api/report/pdf?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}&score=${encodeURIComponent(
            String(score),
          )}&riskCount=${encodeURIComponent(String(riskCount))}`;

          const res = await fetch(url);
          if (!res.ok) {
            const raw = await res.text();
            let msg = "Failed to generate PDF";
            try {
              msg = JSON.parse(raw)?.error ?? msg;
            } catch {
              // ignore
            }
            throw new Error(msg);
          }

          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = "verdictswarm-report.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to generate PDF");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Generating…" : label}
    </Button>
  );
}

export default function ScanReport({
  address,
  chainId,
  chain,
}: {
  address: string;
  chainId?: number;
  chain?: string;
}) {
  const [token, setToken] = useState<TokenPreview | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [botStatuses, setBotStatuses] = useState<
    Array<
      {
        botKey: string;
        bot: string;
        emoji?: string;
        modelLabel?: string;
        locked?: boolean;
        unlockTier?: TierKey;
        status: "queued" | "running" | "complete" | "error";
        score?: number;
        summary?: string;
        error?: string;
      }
    >
  >([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showSwarmOverlay, setShowSwarmOverlay] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [tierKey, setTierKey] = useState<TierKey>("FREE");
  const [, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    (async () => {
      try {
        setError(null);
        setResult(null);
        setBotStatuses([]);

        const tRes = await fetch(`/api/token/${address}`);
        if (!tRes.ok) throw new Error((await tRes.json())?.error ?? "Token lookup failed");
        const t = (await tRes.json()) as TokenPreview;

        const resolvedChainId = typeof chainId === "number" ? chainId : t.chainId;
        const resolvedChain = chain ?? t.chain ?? "base";

        if (!cancelled) setToken(t);

        // Load auth + quota status (only available when wallet is connected).
        let quotaSnapshot: QuotaInfo | null = null;
        try {
          const q = await fetch("/api/quota", { cache: "no-store" });
          if (q.ok) {
            quotaSnapshot = (await q.json()) as QuotaInfo;
            setQuota(quotaSnapshot);
          } else if (q.status === 401) {
            quotaSnapshot = null;
            setQuota(null);
          }
        } catch {
          // ignore
        }

        // Determine tier (from session if available).
        try {
          const me = await fetch("/api/user", { cache: "no-store" });
          if (me.ok) {
            const data = (await me.json()) as { user: { tierKey?: TierKey } | null };
            if (data?.user?.tierKey) setTierKey(data.user.tierKey);
          }
        } catch {
          // ignore
        }

        // FREE tier must work wallet-free.
        // If user is authenticated, enforce quota client-side for nicer UX.
        // (Server-side enforcement still applies for paid tiers.)
        if (quotaSnapshot && quotaSnapshot.remaining <= 0) {
          throw new Error("Daily limit reached");
        }

        // Prefer SSE proxy to stream bot progress in real-time.
        // Wallet connection is required for ALL scans so quota can be enforced server-side.
        const url = `/api/scan/stream?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(resolvedChain)}&depth=full`;

        setIsScanning(true);
        setShowSwarmOverlay(true);
        setInitMessage("🔍 Identifying token...");

        const fallbackScan = async () => {
          const r = await fetch("/api/scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ address, chainId: resolvedChainId, chain: resolvedChain, depth: "full" }),
          });

          // Read body exactly once (prevents "Unexpected end of JSON input" from a second .json())
          const raw = await r.text();
          const data = raw ? (JSON.parse(raw) as unknown) : null;

          if (!r.ok) {
            const errMsg =
              data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
                ? String((data as { error?: unknown }).error)
                : "Scan failed";
            throw new Error(errMsg);
          }

          // /api/scan returns { ok: true, streamUrl, quota } (does NOT return ScanResult)
          if (
            !data ||
            typeof data !== "object" ||
            !("streamUrl" in data) ||
            typeof (data as { streamUrl?: unknown }).streamUrl !== "string"
          ) {
            throw new Error("Scan failed to start (missing streamUrl)");
          }

          const streamUrl = (data as { streamUrl: string }).streamUrl;
          // Re-open SSE using the server-provided streamUrl (includes quota/tier server-side)
          const absolute = streamUrl.startsWith("http") ? streamUrl : streamUrl;

          return await new Promise<ScanResult>((resolve, reject) => {
            const next = new EventSource(absolute);

            next.addEventListener("verdict", (e) => {
              try {
                const payload = JSON.parse((e as MessageEvent).data);
                resolve(payload as ScanResult);
              } catch (err) {
                reject(err);
              } finally {
                next.close();
              }
            });

            next.onerror = () => {
              next.close();
              reject(new Error("Streaming scan failed"));
            };
          });
        };

        if (typeof window === "undefined" || typeof EventSource === "undefined") {
          const s = await fallbackScan();
          if (!cancelled) setResult(s);
          return;
        }

        let fallbackAttempted = false;

        es = new EventSource(url);

        es.addEventListener("preprocess:start", () => {
          setInitMessage("🔍 Identifying token...");
        });

        es.addEventListener("preprocess:complete", (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            const name = data?.project_name || data?.token_type || "token";
            setInitMessage(`✅ Identified: ${name} — launching agents...`);
          } catch {
            setInitMessage("✅ Token identified — launching agents...");
          }
        });

        es.addEventListener("start", (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            const queued = Array.isArray(data?.bots) ? data.bots : [];

            const nextTier = (data?.tierKey as TierKey) ?? tierKey;
            if (nextTier) setTierKey(nextTier);

            const queuedMap = new Map<string, unknown>(queued.map((b: { bot: string }) => [String(b.bot), b]));

            // Always render full catalog. Bots above current tier are shown locked.
            setBotStatuses(
              BOT_CATALOG.map((c) => {
                queuedMap.get(c.key);
                const locked = tierRank(nextTier) < tierRank(c.unlockTier);
                return {
                  botKey: c.key,
                  bot: c.name,
                  emoji: c.emoji,
                  modelLabel: c.modelLabel,
                  locked,
                  unlockTier: c.unlockTier,
                  status: "queued",
                };
              }),
            );
          } catch {
            // ignore
          }
        });

        es.addEventListener("bot_start", (e) => {
          const data = JSON.parse((e as MessageEvent).data) as { bot?: string; emoji?: string };
          setBotStatuses((prev) =>
            prev.map((b) =>
              b.botKey === data.bot
                ? { ...b, emoji: data.emoji ?? b.emoji, status: b.locked ? "queued" : "running" }
                : b,
            ),
          );
        });

        es.addEventListener("bot_complete", (e) => {
          const data = JSON.parse((e as MessageEvent).data) as {
            bot?: string;
            emoji?: string;
            score?: number;
            summary?: string;
          };
          setBotStatuses((prev) =>
            prev.map((b) =>
              b.botKey === data.bot
                ? {
                    ...b,
                    emoji: data.emoji ?? b.emoji,
                    score: typeof data.score === "number" ? data.score : b.score,
                    summary: typeof data.summary === "string" ? data.summary : b.summary,
                    status: b.locked ? "queued" : "complete",
                  }
                : b,
            ),
          );
        });

        es.addEventListener("bot_error", (e) => {
          const data = JSON.parse((e as MessageEvent).data) as { bot?: string; emoji?: string; error?: string };
          setBotStatuses((prev) =>
            prev.map((b) =>
              b.botKey === data.bot
                ? {
                    ...b,
                    emoji: data.emoji ?? b.emoji,
                    error: typeof data.error === "string" ? data.error : b.error,
                    status: b.locked ? "queued" : "error",
                  }
                : b,
            ),
          );
        });

        es.addEventListener("verdict", (e) => {
          const data = JSON.parse((e as MessageEvent).data);

          const tierForFilter = (data?.tierKey as TierKey) ?? tierKey;
          const bots: BotResult[] = BOT_CATALOG.map((c) => {
            const locked = tierRank(tierForFilter) < tierRank(c.unlockTier);
            if (locked) {
              const unlockLabel = TIER_COPY[c.unlockTier]?.label ?? "Upgrade";
              return {
                bot: `${c.emoji} ${c.name}`,
                model: c.modelLabel,
                score: 0,
                summary: `🔒 Locked. Upgrade to ${unlockLabel} to unlock.`,
                details: ["This analysis is available on a higher tier."],
                flags: [],
              };
            }
            const v = data?.bots?.[c.key];

            // ScamBot returns a unique schema:
            // { scam_score: number, recommendation: "SAFE"|"CAUTION"|"HIGH_RISK", explanation: string, signals_detected: [...] }
            const isScamBot = c.key === "ScamBot";

            const fallbackScoreFromRecommendation = (rec: unknown) => {
              if (typeof rec !== "string") return 0;
              switch (rec.toUpperCase()) {
                case "SAFE":
                  return 10;
                case "CAUTION":
                  return 5;
                case "HIGH_RISK":
                  return 2;
                default:
                  return 0;
              }
            };

            const reasoningText =
              isScamBot
                ? typeof v?.explanation === "string"
                  ? v.explanation
                  : ""
                : typeof v?.reasoning === "string"
                  ? v.reasoning
                  : "";

            const scoreValue = isScamBot
              ? typeof v?.scam_score === "number"
                ? v.scam_score / 10 // Convert 0-100 to 0-10 scale
                : fallbackScoreFromRecommendation(v?.recommendation)
              : typeof v?.score === "number"
                ? v.score
                : 0;

            const summary = isScamBot
              ? [typeof v?.recommendation === "string" ? v.recommendation : "", reasoningText].filter(Boolean).join(": ")
              : reasoningText;

            return {
              bot: `${c.emoji} ${c.name}`,
              model: c.modelLabel,
              score: scoreValue,
              summary: summary.slice(0, 400) || "(no summary)",
              details: summary ? summary.split(/\n+/).filter(Boolean).slice(0, 6) : [],
              flags: [],
            };
          });

          const isFreeTier = Boolean(data?.free_tier);

          const mapped: ScanResult = {
            address: data?.address ?? address,
            chain: data?.chain ?? resolvedChain,
            chainId: resolvedChainId,
            overall: typeof data?.score === "number" ? data.score : 0,
            bots,
            flags: Array.isArray(data?.flags) ? data.flags : [],
            free_tier: isFreeTier,
            ft_verdict:
              isFreeTier && typeof data?.verdict === "string"
                ? (data.verdict as "HEALTHY" | "UNHEALTHY" | "UNKNOWN")
                : undefined,
            ft_reason: isFreeTier && typeof data?.reason === "string" ? data.reason : undefined,
            ft_label: isFreeTier && (typeof data?.label === "string" || data?.label === null) ? data.label : undefined,
            ft_checks: isFreeTier && data?.checks && typeof data.checks === "object" ? (data.checks as FreeTierChecks) : undefined,
          };

          setResult(mapped);
          setIsScanning(false);
          es?.close();
        });

        es.onerror = async () => {
          // If SSE fails early, fall back to non-streaming scan.
          es?.close();
          es = null;

          // Guard against infinite loop: only attempt fallback once
          if (fallbackAttempted) {
            if (!cancelled) {
              setError("Scan failed after retry. Please try again later.");
              setIsScanning(false);
            }
            return;
          }
          fallbackAttempted = true;

          try {
            const s = await fallbackScan();
            if (!cancelled) setResult(s);
          } catch (err: unknown) {
            if (!cancelled) setError(err instanceof Error ? err.message : "Scan failed");
          } finally {
            if (!cancelled) setIsScanning(false);
          }
        };
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Scan failed");
          setIsScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
    // tierKey is intentionally NOT a dependency here: we setTierKey inside this effect.
    // Including it would cause unnecessary re-runs / cancellations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, chain]);

  const verdict = useMemo(() => (result && !result.free_tier ? labelFor(result.overall) : null), [result]);
  const allFlags = useMemo(() => {
    if (!result) return [] as Array<{ bot: string; flag: string }>;
    const perBot = result.bots.flatMap((b) => b.flags.map((f) => ({ bot: b.bot, flag: f })));
    const global = (result.flags ?? []).map((f) => ({ bot: "Scan", flag: f }));
    return [...global, ...perBot];
  }, [result]);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-vs-error">{error}</p>
      </Card>
    );
  }

  if (!result || !token) {
    const unlockedBots = botStatuses.filter((b) => !b.locked);
    const total = unlockedBots.length;
    const complete = unlockedBots.filter((b) => b.status === "complete").length;
    const running = unlockedBots.find((b) => b.status === "running")?.bot;
    const progress = total > 0 ? Math.round((complete / total) * 100) : 0;

    return (
      <>
        {showSwarmOverlay && (
          <SwarmScanOverlay
            tierKey={tierKey}
            isScanning={isScanning}
            resultReady={false}
            address={address}
            chain={chain ?? token?.chain ?? "base"}
            onFinished={() => setShowSwarmOverlay(false)}
            // sound hooks (wired, not implemented here)
            onStepSound={() => {}}
            onVerdictSound={() => {}}
          />
        )}
        <div className="space-y-6">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs tracking-widest text-white/55">COURT IN SESSION</p>
            <h2 className="text-2xl font-semibold">{isScanning ? "The jury is deliberating…" : "Preparing the docket…"}</h2>
            {initMessage && !isScanning && (
              <p className="text-sm text-[#00D4AA] font-mono animate-pulse">{initMessage}</p>
            )}
            <p className="text-sm text-white/65">
              {running ? (
                <>
                  Now running: <span className="font-semibold text-white">{running}</span>
                </>
              ) : (
                "Summoning jurors and gathering on-chain + social evidence"
              )}
            </p>

            {total > 0 && (
              <div className="mt-5 w-full max-w-3xl">
                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>
                    {complete}/{total} complete
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-vs-cyan via-vs-purple to-vs-pink transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {botStatuses.length > 0 && (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {botStatuses.map((b) => {
                const isRunning = b.status === "running";
                const isLocked = Boolean(b.locked);
                const unlockLabel = b.unlockTier ? TIER_COPY[b.unlockTier].label : "Upgrade";

                return (
                  <div
                    key={b.bot}
                    className={
                      "relative overflow-hidden rounded-2xl border px-5 py-4 transition " +
                      (isLocked
                        ? "border-white/10 bg-black/10 opacity-60"
                        : isRunning
                          ? "border-vs-cyan/40 bg-vs-cyan/10"
                          : b.status === "complete"
                            ? "border-white/10 bg-black/20"
                            : b.status === "error"
                              ? "border-vs-error/30 bg-vs-error/10"
                              : "border-white/10 bg-black/10")
                    }
                  >
                    {isRunning && (
                      <div className="pointer-events-none absolute inset-0 opacity-30">
                        <div className="absolute -left-24 top-0 h-full w-48 animate-pulse bg-gradient-to-r from-transparent via-vs-cyan/30 to-transparent" />
                      </div>
                    )}

                    <div className="relative flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "flex h-10 w-10 items-center justify-center rounded-xl border text-lg " +
                            (isLocked
                              ? "border-white/10 bg-black/25"
                              : isRunning
                                ? "border-vs-cyan/40 bg-vs-cyan/15"
                                : b.status === "complete"
                                  ? "border-white/10 bg-black/30"
                                  : b.status === "error"
                                    ? "border-vs-error/30 bg-vs-error/10"
                                    : "border-white/10 bg-black/20")
                          }
                        >
                          {b.emoji ?? "•"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{b.bot}</span>
                            {b.modelLabel && (
                              <span className="text-[11px] rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-white/65">
                                {b.modelLabel}
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-white/60">
                            {isLocked ? (
                              <span>🔒 Unlock with {unlockLabel}</span>
                            ) : (
                              <>
                                {b.status === "queued" && "Queued"}
                                {b.status === "running" && (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vs-cyan/70" />
                                      <span className="relative inline-flex h-2 w-2 rounded-full bg-vs-cyan" />
                                    </span>
                                    Running…
                                  </span>
                                )}
                                {b.status === "complete" && "Complete"}
                                {b.status === "error" && (b.error ? `Error: ${b.error}` : "Error")}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isLocked ? (
                          <span className="text-sm font-semibold text-white/35">—</span>
                        ) : b.status === "complete" ? (
                          <span className="text-sm font-semibold text-vs-success">✓</span>
                        ) : b.status === "error" ? (
                          <span className="text-sm font-semibold text-vs-error">!</span>
                        ) : (
                          <span className="text-sm font-semibold text-white/35">…</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Tier comparison</p>
              <p className="mt-1 text-xs text-white/55">See what unlocks when you upgrade your tier.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Your tier</div>
              <div className="text-sm font-semibold">{TIER_COPY[tierKey].label}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {(Object.keys(TIER_COPY) as TierKey[]).map((k) => {
              const t = TIER_COPY[k];
              const active = k === tierKey;
              return (
                <div
                  key={k}
                  className={
                    "rounded-2xl border p-4 " +
                    (active ? "border-vs-cyan/40 bg-vs-cyan/10" : "border-white/10 bg-black/20")
                  }
                >
                  <div className="text-xs font-semibold tracking-wide text-white/80">{t.label}</div>
                  <ul className="mt-2 space-y-1 text-xs text-white/60">
                    {t.perks.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      </>
    );
  }

  const chainLabel = token.chainName ?? token.chain ?? (typeof result.chainId === "number" ? String(result.chainId) : "");

  const ftVerdict = result.free_tier ? result.ft_verdict ?? "UNKNOWN" : null;
  const ftIsHealthy = ftVerdict === "HEALTHY";
  const ftIsUnhealthy = ftVerdict === "UNHEALTHY";
  const ftColor = ftIsHealthy ? "text-vs-success" : ftIsUnhealthy ? "text-vs-warning" : "text-white/70";
  const ftHeadline = ftIsHealthy ? "✅ HEALTHY" : ftIsUnhealthy ? "⚠️ UNHEALTHY" : "❔ UNKNOWN";

  return (
    <>
      {showSwarmOverlay && (
        <SwarmScanOverlay
          tierKey={tierKey}
          isScanning={false}
          resultReady={Boolean(result) && !Boolean(result.free_tier)}
          resultOverall={result.overall}
          address={address}
          chain={result.chain ?? chain ?? token.chain ?? "base"}
          onFinished={() => setShowSwarmOverlay(false)}
          // sound hooks (wired, not implemented here)
          onStepSound={() => {}}
          onVerdictSound={() => {}}
        />
      )}

      <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs tracking-widest text-white/55">SCAN REPORT</p>
            <h1 className="mt-2 text-2xl font-semibold">
              {token.name} <span className="text-white/60">({token.symbol})</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Contract: <span className="font-mono text-white/80">{address}</span>
            </p>
            {chainLabel && (
              <p className="mt-1 text-sm text-white/60">
                Chain: <span className="text-white/80">{chainLabel}</span>
              </p>
            )}
          </div>

          {result.free_tier ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
              <div className={`text-2xl font-semibold ${ftColor}`}>{ftHeadline}</div>
              {result.ft_label && <div className="mt-2 text-sm text-white/70">{result.ft_label}</div>}
              {result.ft_reason && <div className="mt-1 text-xs text-white/55">{result.ft_reason}</div>}
              <div className="mt-2 text-xs text-white/50">FREE tier (no numeric score)</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
              <div className={`text-xs font-semibold ${verdict?.color}`}>{verdict?.text}</div>
              <div className="mt-1 text-4xl font-semibold">{result.overall.toFixed(1)}</div>
              <div className="mt-1 text-xs text-white/50">Overall score (0–10)</div>
            </div>
          )}
          {result.free_tier && (
            <div className="mt-6 border-t border-white/5 pt-6 space-y-5">
              {/* Progress bar (mock balances for now). TODO: wire to real vswarm balance from /api/user */}
              <ProgressToTier currentBalance={0} tierThreshold={50000} tierName="Investigator" />

              {/* Mock states for quick visual QA (remove once wired to real balance) */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="text-xs font-semibold text-white/70">Mock balance: 500</div>
                  <div className="mt-3">
                    <ProgressToTier currentBalance={500} tierThreshold={50000} tierName="Investigator" />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="text-xs font-semibold text-white/70">Mock balance: 700</div>
                  <div className="mt-3">
                    <ProgressToTier currentBalance={700} tierThreshold={50000} tierName="Investigator" />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="text-xs font-semibold text-white/70">Mock balance: 900</div>
                  <div className="mt-3">
                    <ProgressToTier currentBalance={900} tierThreshold={50000} tierName="Investigator" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              const url = window.location.href;
              await navigator.clipboard.writeText(url);
            }}
          >
            Copy Link
          </Button>

          {verdict && (
            <>
              <ShareButton
                tokenName={token.name}
                tokenSymbol={token.symbol}
                verdict={verdict.text}
                score={result.overall}
                keyFindings={(allFlags ?? []).slice(0, 3).map((f) => f.flag)}
              />

              <VerdictCardDownloadButton
                tokenName={token.name}
                tokenSymbol={token.symbol}
                verdict={verdict.text}
                score={result.overall}
                findings={(allFlags ?? []).slice(0, 5).map((f) => f.flag)}
                reportUrl={typeof window !== "undefined" ? window.location.href : undefined}
              />
            </>
          )}

          <PdfDownloadButton
            address={address}
            chain={result.chain ?? chain ?? token.chain ?? "base"}
            tierKey={tierKey}
            score={result.overall}
            riskCount={allFlags.length}
          />
        </div>

        <p className="mt-3 text-xs text-white/45">Analysis only. Not financial advice. DYOR.</p>

        <div className="mt-4">
          <PerVerdictDisclaimer />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Tier comparison</p>
            <p className="mt-1 text-xs text-white/55">See what unlocks when you upgrade your tier.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/50">Your tier</div>
            <div className="text-sm font-semibold">{TIER_COPY[tierKey].label}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {(Object.keys(TIER_COPY) as TierKey[]).map((k) => {
            const t = TIER_COPY[k];
            const active = k === tierKey;
            return (
              <div
                key={k}
                className={
                  "rounded-2xl border p-4 " + (active ? "border-vs-cyan/40 bg-vs-cyan/10" : "border-white/10 bg-black/20")
                }
              >
                <div className="text-xs font-semibold tracking-wide text-white/80">{t.label}</div>
                <ul className="mt-2 space-y-1 text-xs text-white/60">
                  {t.perks.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-500">
        {result.bots.map((b) => (
          <Card key={b.bot} className="p-6 animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{b.bot}</p>
                {b.model && (
                  <p className="mt-1 text-xs text-white/55">
                    Model: <span className="text-white/80">{b.model}</span>
                  </p>
                )}
                <p className="mt-2 text-sm text-white/70">{b.summary}</p>
              </div>
              <div className="text-right">
                {result.free_tier ? (
                  <>
                    <div className="text-xs text-white/50">Score</div>
                    <div className="text-2xl font-semibold text-white/35">—</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-white/50">Score</div>
                    <div className="text-2xl font-semibold">{b.score.toFixed(1)}</div>
                  </>
                )}
              </div>
            </div>

            {b.flags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {b.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-vs-error/30 bg-vs-error/10 px-3 py-1 text-xs text-vs-error"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            <button
              className="mt-5 text-sm text-white/65 hover:text-white"
              onClick={() => setOpen((o) => ({ ...o, [b.bot]: !o[b.bot] }))}
            >
              {open[b.bot] ? "Hide details" : "Show details"}
            </button>

            {open[b.bot] && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/65">
                {b.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {result.free_tier && (
        <Card className="p-6">
          <p className="text-sm font-medium">Basic checks (FREE)</p>
          <p className="mt-1 text-xs text-white/55">Quick on-chain heuristics — upgrade to unlock full AI analysis.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(result.ft_checks ?? {}).map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold text-white/75">{k}</div>
                <div className="mt-1 text-sm text-white/70">
                  {typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v)}
                </div>
              </div>
            ))}
            {Object.keys(result.ft_checks ?? {}).length === 0 && <p className="text-sm text-white/60">No checks returned.</p>}
          </div>
        </Card>
      )}

      {result.free_tier && (
        <div className="mt-12 space-y-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Premium Swarm Analysis
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <LockedTierCard
              tier="TIER 1+"
              title="Advanced AI Analysis"
              agents="Technician, Investigator, Economist, Witness"
              description="Full multi-agent swarm analysis using GPT-4o Mini, Claude Haiku, Gemini Flash & Grok 3. Deep dives into security, social sentiment, and tokenomics."
              progressPct={45}
            />
            <LockedTierCard
              tier="TIER 2+"
              title="Whale Wallet Tracking"
              agents="The Advisor, Devil's Advocate, The Observer"
              description="Real-time monitoring of top holders and smart money movements. Includes vision-based chart analysis."
              progressPct={20}
            />
            <LockedTierCard
              tier="TIER 3+"
              title="Real-time Alerts"
              agents="Apex Swarm"
              description="Instant notifications on sentiment shifts or liquidity anomalies before they hit the public feed."
              progressPct={5}
            />
          </div>

          <Card className="relative overflow-hidden p-8 border-vs-purple/30 bg-vs-purple/5">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-vs-purple/20 blur-3xl" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-vs-purple/40 bg-vs-purple/10 px-4 py-1.5 text-xs font-semibold text-vs-purple">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vs-purple/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-vs-purple" />
                </span>
                UPGRADE RECOMMENDED
              </div>

              <h3 className="mt-6 text-2xl font-bold text-white">
                {(() => {
                  const variants = [
                    "You're leaving alpha on the table",
                    "Premium users saw this signal 2 hours ago",
                    "Unlock full swarm analysis",
                  ];
                  // In a real A/B test, we'd use a stable seed or user ID. 
                  // For now, we'll just pick one to show the implementation.
                  // TODO: Wire to A/B testing framework
                  return variants[0];
                })()}
              </h3>
              
              <div className="mt-4 max-w-lg">
                <p className="text-white/70 italic">
                  "3 concerning patterns detected in top holder distribution... "
                  <span className="select-none blur-[4px] opacity-50">
                    and significant wash trading volume identified on secondary DEXes.
                  </span>
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button 
                  size="md" 
                  className="px-8 bg-gradient-to-r from-vs-purple to-vs-cyan hover:scale-[1.02] transition-transform"
                  onClick={() => window.location.href = '/staking'}
                >
                  Upgrade to Premium
                </Button>
                <Button variant="secondary" size="md" onClick={() => window.location.href = '/tiers'}>
                  Compare Tiers
                </Button>
              </div>
              
              <p className="mt-4 text-xs text-white/40">
                Join 1,240+ traders using premium swarm intelligence.
              </p>
            </div>
          </Card>
        </div>
      )}

      {!result.free_tier && (
        <Card className="p-6">
          <p className="text-sm font-medium">Flags & Warnings</p>
          {allFlags.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">No critical flags detected.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {allFlags.map((f, idx) => (
                <li key={`${f.bot}:${idx}`} className="flex items-start justify-between gap-4">
                  <span>{f.flag}</span>
                  <span className="text-xs text-white/45">{f.bot}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
    </>
  );
}
