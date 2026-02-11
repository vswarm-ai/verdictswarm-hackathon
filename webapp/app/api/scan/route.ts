import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";
import { consume } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  requireSessionPassword();

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ error: "Wallet connection required" }, { status: 401 });
  }

  // Enforce daily scan quota here for all tiers.
  const quota = await consume(session.user.address, session.user.tierKey);
  // consume() returns remaining=0 without incrementing when already at limit.
  const atLimit = quota.used >= quota.limit && quota.remaining === 0;
  if (atLimit) {
    return NextResponse.json({ error: "Daily limit reached", ...quota }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as
    | { address?: string; contractAddress?: string; chainId?: number; chain?: string; depth?: string }
    | null;

  const address = body?.address ?? body?.contractAddress;
  const chain = typeof body?.chain === "string" ? body.chain : undefined;
  const depth = typeof body?.depth === "string" ? body.depth : "full";

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const chainForStream = chain ?? "base";

  // The client opens the streaming SSE connection against our proxy route.
  // Keep /api/scan as a simple JSON ack to avoid holding a long-lived request
  // in serverless.
  return NextResponse.json({
    ok: true,
    quota,
    streamUrl: `/api/scan/stream?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chainForStream)}&depth=${encodeURIComponent(depth)}`,
  });
}
