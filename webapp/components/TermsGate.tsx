"use client";

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "vs_tos_accepted_v1";

function shouldBypassGate() {
  // Deterministic bypass for automated tests.
  // Prefer query param so Playwright can opt-in without coupling to storage.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("e2e") === "1" || params.get("acceptTerms") === "1") return true;
  } catch {}

  // Also allow an explicit flag in localStorage (useful for test harnesses).
  try {
    return window.localStorage.getItem("vs_e2e") === "1";
  } catch {
    return false;
  }
}

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    // If this is an E2E run, never show the gate.
    if (shouldBypassGate()) {
      setAccepted(true);
      setReady(true);
      return;
    }

    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      setAccepted(v === "true");
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) return null;

  if (!accepted) {
    return (
      <div
        data-testid="terms-gate"
        className="mx-auto mt-10 max-w-3xl rounded-xl border border-white/10 bg-black/30 p-6"
      >
        <h2 className="text-lg font-semibold">Terms notice</h2>
        <p className="mt-3 text-sm text-white/70">
          By using VerdictSwarm you agree that all outputs are automated risk assessments and
          opinions, not statements of fact. Do not rely on this as financial advice. You are
          responsible for verifying all information independently.
        </p>
        <p className="mt-3 text-sm text-white/70">
          A &quot;Flagged&quot; rating does not accuse anyone of a crime. A &quot;Low Risk&quot; rating does not
          guarantee safety.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            data-testid="terms-accept"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            onClick={() => {
              try {
                window.localStorage.setItem(STORAGE_KEY, "true");
              } finally {
                setAccepted(true);
              }
            }}
          >
            I Agree & Continue
          </button>
        </div>
        <p className="mt-4 text-xs text-white/50">If you do not agree, do not use this service.</p>
      </div>
    );
  }

  return <>{children}</>;
}
