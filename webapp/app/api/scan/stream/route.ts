import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function GET(req: Request) {
  requireSessionPassword();

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);

  // Hackathon: allow FREE tier scans without wallet auth for judges/demo
  // Post-hackathon: restore wallet requirement
  const tierKey = session.user?.tierKey ?? "FREE";

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") ?? "";
  const chain = searchParams.get("chain") ?? "base";
  const depth = searchParams.get("depth") ?? "full";

  if (!address) {
    return new Response("Missing address", { status: 400 });
  }

  // IMPORTANT: Do not use NEXT_PUBLIC_* env vars on the server.
  // Vercel may not provide them to serverless functions unless also defined
  // without the NEXT_PUBLIC_ prefix.
  const apiBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // Make this explicit so Vercel logs show the real cause instead of a generic 500.
    requireEnv("API_URL");
  }

  const backendUrl = new URL("/api/scan/stream", apiBase!);
  backendUrl.searchParams.set("address", address);
  backendUrl.searchParams.set("chain", chain);
  backendUrl.searchParams.set("depth", depth);
  // Accept frontend tier override for connected wallets
  // Once token launches, remove this and use only session.user.tierKey
  const frontendTier = searchParams.get("tier");
  const effectiveTier = frontendTier && session.user?.address ? frontendTier : tierKey;
  backendUrl.searchParams.set("tier", effectiveTier);

  const upstream = await fetch(backendUrl, {
    method: "GET",
    headers: {
      accept: "text/event-stream",
      // Ensure no buffering proxies
      "cache-control": "no-cache",
      // Forward wallet so backend can enforce FREE-tier quota.
      "x-wallet-address": session.user?.address ?? "anonymous",
    },
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "Upstream error", { status: upstream.status || 502 });
  }

  const headers = new Headers();
  headers.set("content-type", "text/event-stream; charset=utf-8");
  headers.set("cache-control", "no-cache, no-transform");
  headers.set("connection", "keep-alive");

  // Pipe upstream SSE response through.
  return new Response(upstream.body, { status: 200, headers });
}
