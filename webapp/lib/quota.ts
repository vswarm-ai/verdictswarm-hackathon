import { promises as fs } from "fs";
import path from "path";
import type { TierKey } from "./tier";
import { tierByKey } from "./tier";

type QuotaStore = {
  // dateKey -> wallet -> count
  [dateKey: string]: {
    [address: string]: number;
  };
};

const DATA_PATH = path.join(process.cwd(), "data", "quota.json");

function todayKey(): string {
  const d = new Date();
  // YYYY-MM-DD in server timezone.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function readStore(): Promise<QuotaStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    return JSON.parse(raw) as QuotaStore;
  } catch {
    return {};
  }
}

async function writeStore(store: QuotaStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getUsage(address: string): Promise<number> {
  const store = await readStore();
  const key = todayKey();
  return store[key]?.[address.toLowerCase()] ?? 0;
}

export async function getRemaining(address: string, tierKey: TierKey): Promise<number> {
  const used = await getUsage(address);
  const limit = tierByKey(tierKey).dailyScans;
  return Math.max(0, limit - used);
}

export async function consume(address: string, tierKey: TierKey): Promise<{ used: number; remaining: number; limit: number }> {
  const store = await readStore();
  const key = todayKey();
  const wallet = address.toLowerCase();

  store[key] ??= {};
  store[key][wallet] ??= 0;

  const limit = tierByKey(tierKey).dailyScans;
  if (store[key][wallet] >= limit) {
    return { used: store[key][wallet], remaining: 0, limit };
  }

  store[key][wallet] += 1;
  await writeStore(store);

  const used = store[key][wallet];
  return { used, remaining: Math.max(0, limit - used), limit };
}
