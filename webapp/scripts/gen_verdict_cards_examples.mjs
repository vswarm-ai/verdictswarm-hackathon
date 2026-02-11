// Generates example SVG verdict cards by calling the local Next dev server.
// Usage:
//   node scripts/gen_verdict_cards_examples.mjs --baseUrl=http://localhost:3010
//
import fs from "node:fs";

const baseUrlArg = process.argv.find((a) => a.startsWith("--baseUrl="));
const baseUrl = baseUrlArg ? baseUrlArg.split("=")[1] : "http://localhost:3010";

async function gen(name, payload, outFile) {
  const res = await fetch(`${baseUrl}/api/verdict-card`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  const svg = await res.text();
  fs.writeFileSync(outFile, svg, "utf8");
  console.log(`wrote ${outFile}`);
}

await gen(
  "USDC",
  {
    tokenName: "USD Coin",
    tokenSymbol: "USDC",
    verdict: "AAA",
    score: 9.4,
    findings: [
      "Liquidity deep across major pools",
      "Contract verified and widely integrated",
      "No critical honeypot patterns detected",
      "Stable peg track record strong",
    ],
    reportUrl: "https://verdictswarm.io/scan/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?chain=base",
  },
  "../tmp_share_usdc_verdict_card.svg",
);

await gen(
  "VIRTUAL",
  {
    tokenName: "Virtuals Protocol",
    tokenSymbol: "VIRTUAL",
    verdict: "BB",
    score: 6.1,
    findings: [
      "Holder distribution moderately concentrated",
      "Liquidity adequate but watch slippage",
      "Narrative-driven volatility likely",
    ],
    reportUrl: "https://verdictswarm.io",
  },
  "../tmp_share_virtual_verdict_card.svg",
);

await gen(
  "SCAM",
  {
    tokenName: "Definitely Not A Scam",
    tokenSymbol: "SCAM",
    verdict: "F",
    score: 1.8,
    findings: [
      "Ownership/privileged functions flagged",
      "Liquidity lock missing or unverifiable",
      "High tax / transfer restrictions suspected",
      "Wallet clusters suggest wash trading",
      "Multiple honeypot indicators present",
    ],
    reportUrl: "https://verdictswarm.io",
  },
  "../tmp_share_scam_verdict_card.svg",
);
