import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress as isEvmAddress } from "viem";
import { mainnet, base, arbitrum, polygon, bsc, avalanche } from "viem/chains";

const erc20Abi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const EVM_CHAINS: Array<{ chainId: number; name: string; rpc: string; chain: any }> = [
  {
    chainId: 1,
    name: "Ethereum",
    chain: mainnet,
    rpc: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://cloudflare-eth.com",
  },
  {
    chainId: 8453,
    name: "Base",
    chain: base,
    rpc: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    chain: arbitrum,
    rpc: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
  },
  {
    chainId: 137,
    name: "Polygon",
    chain: polygon,
    rpc: process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-rpc.com",
  },
  {
    chainId: 56,
    name: "BSC",
    chain: bsc,
    rpc: process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org",
  },
  {
    chainId: 43114,
    name: "Avalanche",
    chain: avalanche,
    rpc: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ?? "https://api.avax.network/ext/bc/C/rpc",
  },
];

function isBase58Address(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function normalizeDexScreenerChain(chainId: string) {
  const c = (chainId || "").toLowerCase();
  if (c === "ethereum") return { chain: "ethereum", chainName: "Ethereum", chainId: 1 };
  if (c === "base") return { chain: "base", chainName: "Base", chainId: 8453 };
  if (c === "arbitrum") return { chain: "arbitrum", chainName: "Arbitrum", chainId: 42161 };
  if (c === "polygon") return { chain: "polygon", chainName: "Polygon", chainId: 137 };
  if (c === "bsc") return { chain: "bsc", chainName: "BSC", chainId: 56 };
  if (c === "avalanche") return { chain: "avalanche", chainName: "Avalanche", chainId: 43114 };
  if (c === "solana") return { chain: "solana", chainName: "Solana" };
  return { chain: c || undefined, chainName: chainId };
}

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  const isEvm = isEvmAddress(address);
  const isSolLike = isBase58Address(address);

  if (!isEvm && !isSolLike) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // 1) Fast path: DexScreener returns chain info (works for EVM + Solana).
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (dsRes.ok) {
      const data = (await dsRes.json()) as any;
      const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
      if (pairs.length > 0) {
        const best = pairs
          .slice()
          .sort(
            (a: any, b: any) =>
              (Number(b?.liquidity?.usd) || 0) - (Number(a?.liquidity?.usd) || 0),
          )[0];

        const baseToken = best?.baseToken;
        const name = String(baseToken?.name || "").trim();
        const symbol = String(baseToken?.symbol || "").trim();
        const chainMeta = normalizeDexScreenerChain(String(best?.chainId || ""));

        if (name && symbol) {
          return NextResponse.json({
            name,
            symbol,
            chain: chainMeta.chain,
            chainName: chainMeta.chainName,
            ...(typeof chainMeta.chainId === "number" ? { chainId: chainMeta.chainId } : {}),
          });
        }
      }
    }
  } catch {
    // ignore and fall back
  }

  // 2) EVM fallback: probe multiple chains for ERC20 metadata.
  if (isEvm) {
    const attempts = await Promise.allSettled(
      EVM_CHAINS.map(async (c) => {
        const client = createPublicClient({ chain: c.chain, transport: http(c.rpc) });
        const [name, symbol] = await Promise.all([
          client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "name" }),
          client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
        ]);
        return { name, symbol, chainId: c.chainId, chainName: c.name };
      }),
    );

    const ok = attempts.find((a) => a.status === "fulfilled") as
      | PromiseFulfilledResult<{ name: string; symbol: string; chainId: number; chainName: string }>
      | undefined;

    if (ok?.value) {
      return NextResponse.json(ok.value);
    }

    const firstErr = attempts.find((a) => a.status === "rejected") as
      | PromiseRejectedResult
      | undefined;

    return NextResponse.json(
      { error: (firstErr?.reason as any)?.shortMessage ?? "Token not found on supported EVM chains" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { error: "Token not found (try an EVM contract or a Solana mint supported by DexScreener)" },
    { status: 404 },
  );
}
