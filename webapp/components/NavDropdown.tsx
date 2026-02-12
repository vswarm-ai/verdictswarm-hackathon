"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  { href: "/", label: "🏠 Home" },
  { href: "/community", label: "🐝 Community" },
  { href: "/roadmap", label: "🗺️ Roadmap" },
  { href: "/integrate", label: "🤖 Connect AI Agent" },
];

export default function NavDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/5"
      >
        <span className="text-lg">🐝</span>
        <span className="text-sm font-bold tracking-wide">
          <span className="text-[#6B46C1]">Verdict</span>
          <span className="text-[#00D4AA]">Swarm</span>
        </span>
        <span className="ml-1 text-xs text-white/50">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-[#2D2D3A] bg-[#0A0B0F]/95 p-2 shadow-xl backdrop-blur z-50">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
