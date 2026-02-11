import { base, mainnet, optimism, arbitrum } from "wagmi/chains";

// We include Base by default (required), plus a couple common networks for the dropdown.
export const SUPPORTED_CHAINS = [base, mainnet, optimism, arbitrum] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export const DEFAULT_CHAIN = base;
