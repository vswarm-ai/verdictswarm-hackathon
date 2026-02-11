import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";

export async function GET() {
  requireSessionPassword();
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  return NextResponse.json({ user: session.user ?? null });
}
