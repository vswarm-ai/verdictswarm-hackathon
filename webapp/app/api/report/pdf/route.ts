import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

export const runtime = "nodejs";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";
import type { TierKey } from "@/lib/tier";
import { tierByKey } from "@/lib/tier";

import { consumePdf } from "@/lib/pdfQuota";

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return undefined;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function GET(req: Request) {
  requireSessionPassword();
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") ?? "";
  const chain = (searchParams.get("chain") ?? "base").toLowerCase();

  if (!address || !address.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid address" }, { status: 400 });
  }

  const tierKey: TierKey = session.user.tierKey ?? "FREE";
  tierByKey(tierKey);

  // FREE tier PDF download rate-limit: 5/day (independent of scan quota).
  if (tierKey === "FREE") {
    const quota = await consumePdf(session.user.address, 5);
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: "Free PDF daily limit reached (5/day). Upgrade to unlock unlimited downloads." },
        { status: 429 },
      );
    }
  }

  // Token metadata (name/symbol). Auth not required on token route.
  let tokenName: string | undefined;
  let tokenSymbol: string | undefined;
  try {
    const tRes = await fetch(new URL(`/api/token/${address}`, req.url), { cache: "no-store" });
    if (tRes.ok) {
      const t = (await tRes.json()) as { name?: string; symbol?: string };
      tokenName = t.name;
      tokenSymbol = t.symbol;
    }
  } catch {
    // ignore
  }

  // Minimal scan payload for now (keeps endpoint simple). Can be expanded later.
  const overallScore = asNum(searchParams.get("score"));
  const vitals = {
    contractVerified: asBool(searchParams.get("verified")),
    ageDays: asNum(searchParams.get("ageDays")),
    liquidityUsd: asNum(searchParams.get("liquidityUsd")),
    holderCount: asNum(searchParams.get("holders")),
  };

  const verdictLabel = typeof overallScore === "number" ? (overallScore >= 70 ? "HEALTHY" : "UNHEALTHY") : "UNKNOWN";

  const data = {
    address,
    chain,
    tierKey,
    tokenName,
    tokenSymbol,
    overallScore: typeof overallScore === "number" ? overallScore : 0,
    verdictLabel,
    vitals,
    risks: undefined,
    bots: undefined,
  };

  const railwayUrl = process.env.RAILWAY_API_URL || "https://verdictswarm-production.up.railway.app";
  const res = await fetch(`${railwayUrl}/api/pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: "Failed to generate PDF", detail: text }, { status: 500 });
  }

  const pdf = await res.arrayBuffer();

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="verdictswarm-report.pdf"`,
      "cache-control": "no-store",
    },
  });
}
