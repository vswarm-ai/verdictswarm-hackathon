import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";
import { getRemaining, getUsage } from "@/lib/quota";
import { tierByKey } from "@/lib/tier";

export async function GET() {
  requireSessionPassword();
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = tierByKey(session.user.tierKey);
  const used = await getUsage(session.user.address);
  const remaining = await getRemaining(session.user.address, session.user.tierKey);

  return NextResponse.json({
    address: session.user.address,
    tier: tier.name,
    used,
    remaining,
    limit: tier.dailyScans,
  });
}
