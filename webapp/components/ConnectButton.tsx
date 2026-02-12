"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { SiweMessage } from "siwe";
import { useAccount, useChainId, useSignMessage } from "wagmi";

type WalletType = "solana" | "evm";

type SessionUser = {
  address: string;
  chainId: number;
  tierKey: import("@/lib/tier").TierKey;
  vswarmBalance: number;
  signedInAt: number;
  walletType?: WalletType;
};

export default function ConnectButton() {
  const [walletType, setWalletType] = useState<WalletType>("solana");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync, isPending: isEvmSigning } = useSignMessage();

  const {
    connected: solConnected,
    publicKey,
    signMessage: solSignMessage,
    disconnect: disconnectSolana,
  } = useWallet();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEvmAuthed = useMemo(() => {
    if (!user?.address || !address || user.walletType === "solana") return false;
    return user.address.toLowerCase() === address.toLowerCase();
  }, [user?.address, user?.walletType, address]);

  const isSolanaAuthed = useMemo(() => {
    if (!user?.address || !publicKey || user.walletType !== "solana") return false;
    return user.address === publicKey.toBase58();
  }, [user?.address, user?.walletType, publicKey]);

  async function refreshUser() {
    setLoadingUser(true);
    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = (await res.json()) as { user: SessionUser | null };
      setUser(data.user);
    } finally {
      setLoadingUser(false);
    }
  }

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError(null);
  }, [address, publicKey, walletType]);

  const signInWithEthereum = useCallback(async () => {
    setError(null);
    if (!address) return;

    const nonceRes = await fetch("/api/auth/siwe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "nonce" }),
    });
    const { nonce } = (await nonceRes.json()) as { nonce: string };

    const domain = window.location.host;
    const origin = window.location.origin;

    const message = new SiweMessage({
      domain,
      address,
      statement: "Sign in to VerdictSwarm to unlock your tier and quota.",
      uri: origin,
      version: "1",
      chainId,
      nonce,
    });

    const signature = await signMessageAsync({ message: message.prepareMessage() });

    const verifyRes = await fetch("/api/auth/siwe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        message: message.toMessage(),
        signature,
      }),
    });

    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}));
      throw new Error(data?.error ?? "SIWE verification failed");
    }

    await refreshUser();
  }, [address, chainId, signMessageAsync]);

  const signInWithSolana = useCallback(async () => {
    setError(null);
    if (!publicKey) return;
    if (!solSignMessage) throw new Error("This Solana wallet does not support message signing.");

    const nonceRes = await fetch("/api/auth/solana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "nonce" }),
    });
    const { nonce } = (await nonceRes.json()) as { nonce: string };

    const signText = `VerdictSwarm Solana Sign-In\nNonce: ${nonce}\nURI: ${window.location.origin}`;
    const encoded = new TextEncoder().encode(signText);
    const signatureBytes = await solSignMessage(encoded);

    const signature = Buffer.from(signatureBytes).toString("base64");

    const verifyRes = await fetch("/api/auth/solana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        publicKey: publicKey.toBase58(),
        message: signText,
        signature,
      }),
    });

    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}));
      throw new Error(data?.error ?? "Solana wallet verification failed");
    }

    await refreshUser();
  }, [publicKey, solSignMessage]);

  async function logout() {
    const route = user?.walletType === "solana" ? "/api/auth/solana" : "/api/auth/siwe";
    await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });

    if (user?.walletType === "solana") {
      await disconnectSolana().catch(() => {});
    }

    await refreshUser();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* EVM toggle hidden for Solana hackathon — re-enable post-hackathon */}
      {/* <div className="inline-flex w-fit rounded-xl border border-vs-border bg-vs-surface-2/40 p-1">
        <button
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            walletType === "solana" ? "bg-vs-cyan/20 text-vs-cyan" : "text-white/70 hover:text-white"
          }`}
          onClick={() => setWalletType("solana")}
          type="button"
        >
          Connect Solana Wallet
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            walletType === "evm" ? "bg-vs-cyan/20 text-vs-cyan" : "text-white/70 hover:text-white"
          }`}
          onClick={() => setWalletType("evm")}
          type="button"
        >
          Connect EVM Wallet
        </button>
      </div> */}

      <div className="flex flex-wrap items-center gap-3">
        {walletType === "solana" ? <WalletMultiButton /> : <RKConnectButton />}

        {walletType === "solana" && solConnected && !isSolanaAuthed && (
          <button
            className="h-11 rounded-xl border border-vs-border bg-vs-surface-2/70 px-4 text-sm text-white hover:border-vs-cyan/70 hover:bg-vs-surface-2"
            disabled={loadingUser}
            onClick={() => signInWithSolana().catch((e) => setError(e?.message ?? String(e)))}
          >
            Verify (Solana)
          </button>
        )}

        {walletType === "evm" && isConnected && !isEvmAuthed && (
          <button
            className="h-11 rounded-xl border border-vs-border bg-vs-surface-2/70 px-4 text-sm text-white hover:border-vs-cyan/70 hover:bg-vs-surface-2"
            disabled={isEvmSigning || loadingUser}
            onClick={() => signInWithEthereum().catch((e) => setError(e?.message ?? String(e)))}
          >
            {isEvmSigning ? "Signing…" : "Verify (SIWE)"}
          </button>
        )}

        {(isEvmAuthed || isSolanaAuthed) && (
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:border-white/20"
            onClick={() => logout().catch(() => {})}
          >
            Sign out
          </button>
        )}
      </div>

      {error && <p className="text-sm text-vs-error">{error}</p>}

      {walletType === "solana" && solConnected && !isSolanaAuthed && (
        <p className="text-xs text-white/60">Solana wallet connected ✓</p>
      )}

      {walletType === "evm" && isConnected && !isEvmAuthed && (
        <p className="text-xs text-white/60">EVM wallet connected. Verify to unlock your tier.</p>
      )}

      {(isEvmAuthed || isSolanaAuthed) && user && (
        <p className="text-xs text-white/60">
          Verified as <span className="font-mono">{user.address}</span>
        </p>
      )}
    </div>
  );
}
