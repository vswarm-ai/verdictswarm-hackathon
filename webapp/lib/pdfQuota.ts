import { promises as fs } from "fs";
import path from "path";

type PdfQuotaStore = {
  // dateKey -> wallet -> count
  [dateKey: string]: {
    [address: string]: number;
  };
};

// Vercel serverless file system is read-only except for /tmp.
// Note: /tmp is ephemeral between invocations, which is acceptable for our PDF quota tracking.
const DATA_PATH = path.join("/tmp", "pdf-quota.json");

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function readStore(): Promise<PdfQuotaStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    return JSON.parse(raw) as PdfQuotaStore;
  } catch {
    return {};
  }
}

async function writeStore(store: PdfQuotaStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getPdfUsage(address: string): Promise<number> {
  const store = await readStore();
  const key = todayKey();
  return store[key]?.[address.toLowerCase()] ?? 0;
}

export async function consumePdf(address: string, limitPerDay: number): Promise<{ used: number; remaining: number; limit: number }> {
  const store = await readStore();
  const key = todayKey();
  const wallet = address.toLowerCase();

  store[key] ??= {};
  store[key][wallet] ??= 0;

  if (store[key][wallet] >= limitPerDay) {
    return { used: store[key][wallet], remaining: 0, limit: limitPerDay };
  }

  store[key][wallet] += 1;
  await writeStore(store);

  const used = store[key][wallet];
  return { used, remaining: Math.max(0, limitPerDay - used), limit: limitPerDay };
}
// Force redeploy 1770256615
