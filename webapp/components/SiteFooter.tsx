import Link from "next/link";

import { FooterDisclaimer } from "./LegalDisclaimers";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-vs-border/80">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-white/60">Powered by VerdictSwarm ⚖️</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 px-3 py-1 text-xs font-medium text-[#14F195]">
              <img src="/assets/solana/solana-logomark.svg" alt="Solana" className="h-3 w-3" />
              Built on Solana
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
              Roadmap
            </Link>
            <Link href="/docs" className="hover:text-white">
              Docs
            </Link>
            <Link href="/openclaw" className="hover:text-white">
              OpenClaw
            </Link>
            <a
              href="https://github.com/vswarm-ai/verdictswarm-hackathon"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://x.com/VswarmAi"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              𝕏 / Twitter
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs text-white/45">
          VSwarm provides analysis only — not financial advice. DYOR.
        </p>

        <FooterDisclaimer />
      </div>
    </footer>
  );
}
