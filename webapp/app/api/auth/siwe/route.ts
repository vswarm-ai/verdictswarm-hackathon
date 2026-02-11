import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SiweMessage } from "siwe";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { base } from "viem/chains";

import { sessionOptions, type AppSession, requireSessionPassword } from "@/lib/auth";
import { erc20Abi } from "@/lib/erc20";
import { tierForBalance } from "@/lib/tier";

function randomNonce(length = 16): string {
  // Simple nonce for MVP.
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getVswarmBalance(address: Address): Promise<number> {
  const tokenAddress = (process.env.VSWARM_TOKEN_ADDRESS ?? "0xVSWARM_TOKEN_ADDRESS") as Address;

  // If placeholder is still set, avoid throwing.
  if (!tokenAddress.startsWith("0x") || tokenAddress.includes("VSWARM")) return 0;

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
  });

  const [decimals, bal] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
  ]);

  // Return whole-token float for tiering (MVP). For production, keep in BigInt.
  const asNumber = Number(formatUnits(bal, decimals));
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export async function POST(req: Request) {
  requireSessionPassword();

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  const body = (await req.json().catch(() => ({}))) as any;

  // Step 1: request nonce
  if (body?.action === "nonce") {
    session.nonce = randomNonce();
    await session.save();
    return NextResponse.json({ nonce: session.nonce });
  }

  // Step 2: verify signature
  if (body?.action === "verify") {
    try {
      const message = new SiweMessage(body.message);
      const signature = body.signature as string;

      const expectedNonce = session.nonce;
      if (!expectedNonce) {
        return NextResponse.json({ error: "Missing nonce" }, { status: 400 });
      }

      const domain = process.env.SIWE_DOMAIN ?? new URL(req.url).host;
      const result = await message.verify({ signature, domain, nonce: expectedNonce });

      if (!result.success) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }

      const address = message.address as Address;
      const chainId = Number(message.chainId);

      // Token-gated tiering on Base L2.
      const vswarmBalance = await getVswarmBalance(address);
      const tier = tierForBalance(vswarmBalance);

      session.user = {
        address,
        chainId,
        tierKey: tier.key,
        vswarmBalance,
        signedInAt: Date.now(),
        walletType: "evm",
      };
      session.nonce = undefined;
      await session.save();

      return NextResponse.json({ ok: true, user: session.user });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "SIWE verification failed" }, { status: 400 });
    }
  }

  // Optional: logout
  if (body?.action === "logout") {
    session.destroy();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
