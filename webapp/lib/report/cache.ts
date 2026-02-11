import { promises as fs } from "fs";
import path from "path";

// Vercel serverless file system is read-only except for /tmp.
// Note: /tmp is ephemeral between invocations, which is acceptable for caching.
const CACHE_DIR = path.join("/tmp", "pdf-cache");

export function cacheKey(params: { address: string; chain: string; tierKey: string }): string {
  const a = params.address.toLowerCase();
  const c = String(params.chain || "").toLowerCase();
  const t = String(params.tierKey || "").toLowerCase();
  return `${c}__${a}__${t}.pdf`;
}

export async function readCachedPdf(key: string): Promise<Buffer | null> {
  try {
    const p = path.join(CACHE_DIR, key);
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

export async function writeCachedPdf(key: string, pdf: Buffer): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const p = path.join(CACHE_DIR, key);
  await fs.writeFile(p, pdf);
}
