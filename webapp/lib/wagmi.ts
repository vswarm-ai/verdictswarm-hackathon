"use client";

import "@rainbow-me/rainbowkit/styles.css";

// Some build/prerender environments provide a partial `localStorage` shim.
// Wagmi/RainbowKit expect the full Storage API, so we patch a minimal stub when needed.
if (typeof window === "undefined") {
  const g: any = globalThis as any;
  if (!g.localStorage || typeof g.localStorage.getItem !== "function") {
    g.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  }
}

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";

// Client-side Wagmi/RainbowKit config.
// RPC URLs can be overridden via NEXT_PUBLIC_* env vars.
export const wagmiConfig = getDefaultConfig({
  appName: "VerdictSwarm",
  // WalletConnect v2 requires a projectId. For local dev, we fall back to a dummy value.
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains: [...SUPPORTED_CHAINS],
  transports: {
    // Base
    8453: http(process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org"),
    // Ethereum
    1: http(process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://cloudflare-eth.com"),
    // Optimism
    10: http(process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL ?? "https://mainnet.optimism.io"),
    // Arbitrum
    42161: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc"),
  },
  // Disable SSR to avoid build-time storage access issues in some environments.
  ssr: false,
});
