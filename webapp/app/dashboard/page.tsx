"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

/* ─── Types ─── */

type ScanHistoryItem = {
  id: string;
  ticker: string;
  address: string;
  grade: string;
  score: number;
  verdict: "Safe" | "Caution" | "Dangerous";
  risk: "Low" | "Medium" | "High";
  time: string;
  chain: string;
  favorite: boolean;
};

type FilterTab = "my-scans" | "trending" | "high-risk" | "favorites";

/* ─── Mock Data ─── */

const MOCK_HISTORY: ScanHistoryItem[] = [
  {
    id: "1",
    ticker: "$PEPE",
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    grade: "A-",
    score: 85,
    verdict: "Safe",
    risk: "Low",
    time: "2h ago",
    chain: "Ethereum",
    favorite: true,
  },
  {
    id: "2",
    ticker: "$TOKEN",
    address: "0x1234567890AbCdEf1234567890AbCdEf12345678",
    grade: "B",
    score: 62,
    verdict: "Caution",
    risk: "Medium",
    time: "5h ago",
    chain: "Base",
    favorite: false,
  },
  {
    id: "3",
    ticker: "$SCAM",
    address: "0xDeAdBeEf00000000000000000000000000000000",
    grade: "F",
    score: 15,
    verdict: "Dangerous",
    risk: "High",
    time: "Yesterday",
    chain: "BSC",
    favorite: false,
  },
];

/* ─── Helpers ─── */

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#00D4AA";
  if (grade.startsWith("B") || grade.startsWith("C")) return "#FFD700";
  return "#FF0055";
}

function verdictIcon(verdict: string): string {
  switch (verdict) {
    case "Safe": return "✅";
    case "Caution": return "⚠️";
    case "Dangerous": return "❌";
    default: return "❔";
  }
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "Safe": return "text-[#00D4AA]";
    case "Caution": return "text-[#FFD700]";
    case "Dangerous": return "text-[#FF0055]";
    default: return "text-white/60";
  }
}

function riskBarWidth(risk: string): string {
  switch (risk) {
    case "Low": return "33%";
    case "Medium": return "66%";
    case "High": return "100%";
    default: return "0%";
  }
}

function riskBarColor(risk: string): string {
  switch (risk) {
    case "Low": return "risk-low";
    case "Medium": return "risk-medium";
    case "High": return "risk-high";
    default: return "bg-gray-600";
  }
}

/* ─── Dashboard Page ─── */

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("my-scans");
  const [items, setItems] = useState(MOCK_HISTORY);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "my-scans", label: "My Scans" },
    { key: "trending", label: "Trending" },
    { key: "high-risk", label: "High Risk" },
    { key: "favorites", label: "Favorites" },
  ];

  const filtered = items.filter((item) => {
    switch (activeTab) {
      case "favorites": return item.favorite;
      case "high-risk": return item.risk === "High";
      case "trending": return true; // would be server-filtered in production
      default: return true;
    }
  });

  const toggleFavorite = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    );
  };

  return (
    <main className="py-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-orbitron text-2xl font-bold uppercase tracking-wider md:text-3xl">
              Scan History
            </h1>
            <p className="mt-1 text-sm text-white/50">Review past investigations</p>
          </div>
          <Link
            href="/dapp"
            className="btn-primary inline-flex h-10 items-center justify-center rounded-xl px-6 text-sm font-bold text-black"
          >
            New Scan
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#6B46C1]/20 border border-[#6B46C1]/40 text-white shadow-[0_0_10px_rgba(107,70,193,0.2)]"
                  : "border border-[#2D2D3A] bg-[#13131F]/50 text-white/60 hover:bg-[#1A1A28] hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Desktop Table */}
        {filtered.length > 0 ? (
          <>
            {/* Desktop View */}
            <div className="mt-6 hidden md:block">
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2D2D3A]">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white/50">
                        Token
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white/50">
                        Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white/50">
                        Verdict
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white/50">
                        Risk
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-white/50">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="group border-b border-[#2D2D3A]/50 transition hover:bg-[#1A1A28]"
                      >
                        <td className="px-6 py-5">
                          <Link
                            href={`/scan/${item.address}`}
                            className="flex items-center gap-3"
                          >
                            <span className="font-orbitron text-lg font-bold text-white">
                              {item.ticker}
                            </span>
                            <span
                              className="rounded border px-2 py-0.5 text-xs font-bold"
                              style={{
                                color: gradeColor(item.grade),
                                borderColor: `${gradeColor(item.grade)}40`,
                                backgroundColor: `${gradeColor(item.grade)}10`,
                              }}
                            >
                              {item.grade}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-5 text-sm text-white/60">
                          {item.time}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`flex items-center gap-2 text-sm font-medium ${verdictColor(item.verdict)}`}>
                            <span>{verdictIcon(item.verdict)}</span>
                            {item.verdict}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-[#2D2D3A]">
                              <div
                                className={`h-full rounded-full ${riskBarColor(item.risk)}`}
                                style={{ width: riskBarWidth(item.risk) }}
                              />
                            </div>
                            <span className="text-xs text-white/50">{item.risk}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="rounded-lg p-2 text-[#00D4AA]/60 transition hover:bg-[#00D4AA]/10 hover:text-[#00D4AA]"
                              title="Re-Scan"
                            >
                              🔄
                            </button>
                            <button
                              onClick={() => toggleFavorite(item.id)}
                              className={`rounded-lg p-2 transition hover:bg-[#FFD700]/10 ${
                                item.favorite ? "text-[#FFD700]" : "text-[#FFD700]/30 hover:text-[#FFD700]/60"
                              }`}
                              title="Favorite"
                            >
                              ★
                            </button>
                            <button
                              className="rounded-lg p-2 text-[#FF0055]/40 transition hover:bg-[#FF0055]/10 hover:text-[#FF0055]"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* Mobile View */}
            <div className="mt-6 space-y-3 md:hidden">
              {filtered.map((item) => (
                <Link key={item.id} href={`/scan/${item.address}`}>
                  <Card className="p-4 transition hover:border-[#6B46C1]/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-orbitron text-lg font-bold text-white">
                          {item.ticker}
                        </span>
                        <span
                          className="rounded border px-2 py-0.5 text-xs font-bold"
                          style={{
                            color: gradeColor(item.grade),
                            borderColor: `${gradeColor(item.grade)}40`,
                            backgroundColor: `${gradeColor(item.grade)}10`,
                          }}
                        >
                          {item.grade}
                        </span>
                      </div>
                      <span className={`text-sm ${verdictColor(item.verdict)}`}>
                        {verdictIcon(item.verdict)} {item.verdict}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                      <span>{item.time}</span>
                      <span>{item.chain}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#2D2D3A]">
                      <div
                        className={`h-full rounded-full ${riskBarColor(item.risk)}`}
                        style={{ width: riskBarWidth(item.risk) }}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[#2D2D3A] bg-[#13131F]/50">
              <span className="text-4xl opacity-30">⬡</span>
            </div>
            <h3 className="font-orbitron mt-6 text-lg font-bold uppercase text-white/60">
              No Scans Yet
            </h3>
            <p className="mt-2 text-sm text-white/40">
              Start by scanning your first token.
            </p>
            <Link
              href="/dapp"
              className="btn-primary mt-6 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold text-black"
            >
              Scan Your First Token
            </Link>
          </div>
        )}

        {/* Load More */}
        {filtered.length > 0 && (
          <div className="mt-8 text-center">
            <button className="inline-flex items-center gap-2 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-8 py-3 text-sm font-medium text-[#00D4AA] transition hover:bg-[#00D4AA]/20">
              Load More ↓
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
