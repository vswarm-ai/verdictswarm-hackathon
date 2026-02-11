import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import nacl from "tweetnacl";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";
import { tierByKey } from "@/lib/tier";

function randomNonce(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getSolanaVswarmBalance(_wallet: string): Promise<number> {
  const rawEndpoint =
    process.env.HELIUS_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "";
  // Clean any malformed quotes from env vars
  const endpoint = rawEndpoint.replace(/^["'\s]+|["'\s\\n]+$/g, "") || clusterApiUrl("devnet");
  const conn = new Connection(endpoint, "confirmed");

  // Keep a real RPC touch so environment wiring is exercised during hackathon testing.
  await conn.getLatestBlockhash("confirmed");

  // Hackathon demo behavior:
  // $VSWARM SPL token does not exist on Solana yet, so any verified Solana wallet
  // is granted TIER_1 to demonstrate wallet-gating UX and auth flow.
  return 50_000;
}

export async function POST(req: Request) {
  requireSessionPassword();

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  const body = (await req.json().catch(() => ({}))) as any;

  if (body?.action === "nonce") {
    session.nonce = randomNonce();
    await session.save();
    return NextResponse.json({ nonce: session.nonce });
  }

  if (body?.action === "verify") {
    try {
      const expectedNonce = session.nonce;
      if (!expectedNonce) {
        return NextResponse.json({ error: "Missing nonce" }, { status: 400 });
      }

      const publicKeyString = body?.publicKey as string;
      const message = body?.message as string;
      const signatureB64 = body?.signature as string;

      if (!publicKeyString || !message || !signatureB64) {
        return NextResponse.json({ error: "Missing verification fields" }, { status: 400 });
      }

      if (!message.includes(`Nonce: ${expectedNonce}`)) {
        return NextResponse.json({ error: "Nonce mismatch" }, { status: 401 });
      }

      const publicKey = new PublicKey(publicKeyString);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = Buffer.from(signatureB64, "base64");
      const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

      if (!verified) {
        return NextResponse.json({ error: "Invalid Solana signature" }, { status: 401 });
      }

      const vswarmBalance = await getSolanaVswarmBalance(publicKey.toBase58());
      const tier = tierByKey("TIER_1");

      session.user = {
        address: publicKey.toBase58(),
        chainId: 103,
        tierKey: tier.key,
        vswarmBalance,
        signedInAt: Date.now(),
        walletType: "solana",
      } as any;
      session.nonce = undefined;
      await session.save();

      return NextResponse.json({ ok: true, user: session.user });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message ?? "Solana verification failed" },
        { status: 400 }
      );
    }
  }

  if (body?.action === "logout") {
    session.destroy();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
