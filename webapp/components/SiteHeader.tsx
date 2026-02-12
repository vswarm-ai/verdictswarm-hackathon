import Link from "next/link";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import ConnectButton from "@/components/ConnectButton";
import TierBadge from "@/components/TierBadge";
import NavDropdown from "@/components/NavDropdown";
import { sessionOptions, type AppSession } from "@/lib/auth";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}

export default async function SiteHeader() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);

  return (
    <header className="sticky top-0 z-40 border-b border-vs-border/80 bg-vs-bg/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <NavDropdown />

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/dapp">Scan</NavLink>
            <NavLink href="/tiers">Tiers</NavLink>
            <NavLink href="/docs">Docs</NavLink>
            <Link
              href="/openclaw"
              className="rounded-xl px-3 py-2 text-sm font-medium text-[#00D4AA] hover:bg-[#00D4AA]/10 transition"
            >
              OpenClaw
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session.user && (
            <div className="hidden items-center gap-3 md:flex">
              <span className="text-xs text-white/50">
                {session.user.address.slice(0, 6)}…{session.user.address.slice(-4)}
              </span>
              <TierBadge tierKey={session.user.tierKey} />
            </div>
          )}
          <ConnectButton />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-3 md:hidden">
        <nav className="flex flex-wrap gap-1">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/dapp">Scan</NavLink>
          <NavLink href="/tiers">Tiers</NavLink>
          <NavLink href="/docs">Docs</NavLink>
          <Link
            href="/openclaw"
            className="rounded-xl px-3 py-2 text-sm font-medium text-[#00D4AA] hover:bg-[#00D4AA]/10 transition"
          >
            OpenClaw
          </Link>
        </nav>
      </div>
    </header>
  );
}
