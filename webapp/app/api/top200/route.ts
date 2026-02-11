import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=24h";

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

  // Map CoinGecko data to our format (no fake scores — honest MVP)
  const mapped = data.map((c, idx) => {
    const rank = idx + 1;
    return {
      rank,
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      image: c.image,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? 0,
      // No pre-computed scores — users run real scans
    };
  });

  return NextResponse.json(mapped);
}
