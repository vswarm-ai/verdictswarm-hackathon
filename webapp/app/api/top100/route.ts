import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h";

  const res = await fetch(url, {
    // CoinGecko is rate-limited; cache for a bit.
    next: { revalidate: 60 * 60 },
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "CoinGecko request failed" }, { status: 502 });
  }

  const data = (await res.json()) as any[];

  // Top 5 mocked pre-computed scores + report links.
  const topScores: Record<number, { score: number; reportHref: string }> = {
    1: { score: 9.2, reportHref: "/scan/0x0000000000000000000000000000000000000000?chainId=1" },
    2: { score: 9.0, reportHref: "/scan/0x0000000000000000000000000000000000000000?chainId=1" },
    3: { score: 8.5, reportHref: "/scan/0x0000000000000000000000000000000000000000?chainId=1" },
    4: { score: 8.3, reportHref: "/scan/0x0000000000000000000000000000000000000000?chainId=1" },
    5: { score: 8.1, reportHref: "/scan/0x0000000000000000000000000000000000000000?chainId=1" },
  };

  const mapped = data.map((c, idx) => {
    const rank = idx + 1;
    const enrich = topScores[rank];
    return {
      rank,
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      image: c.image,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? 0,
      ...(enrich ? { score: enrich.score, reportHref: enrich.reportHref } : {}),
    };
  });

  return NextResponse.json(mapped);
}
