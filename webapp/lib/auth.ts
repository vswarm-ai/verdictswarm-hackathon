import type { SessionOptions } from "iron-session";

export type SessionUser = {
  address: string;
  chainId: number;
  tierKey: import("./tier").TierKey;
  vswarmBalance: number;
  signedInAt: number;
  walletType?: "evm" | "solana";
};

export type AppSession = {
  nonce?: string;
  user?: SessionUser;
};

// NOTE: Set SESSION_PASSWORD in .env.local. Must be 32+ chars.
export const sessionOptions: SessionOptions = {
  cookieName: "vswarmsess",
  password:
    process.env.SESSION_PASSWORD ??
    "CHANGE_ME__32_CHARS_MINIMUM__CHANGE_ME__32_CHARS_MINIMUM",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
  },
};

export function requireSessionPassword(): void {
  if (!process.env.SESSION_PASSWORD) {
    // For local dev, we allow fallback but make it loud.
    // In production, you should *always* set SESSION_PASSWORD.
    console.warn(
      "[auth] SESSION_PASSWORD is not set; using insecure fallback. Set it in .env.local (32+ chars)."
    );
  }
}
