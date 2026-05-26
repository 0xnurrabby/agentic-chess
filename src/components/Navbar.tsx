"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import ThemeToggle from "./ThemeToggle";
import LeaderboardModal from "./LeaderboardModal";
import { Activity, BookOpen, Hash, Trophy } from "lucide-react";

export default function Navbar() {
  const stats = useGameStore((s) => s.stats);
  const connected = useGameStore((s) => s.connected);
  const learningMode = useGameStore((s) => s.learningMode);
  const toggleLearning = useGameStore((s) => s.toggleLearningMode);
  const [leaderOpen, setLeaderOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative shrink-0">
              <div className="text-2xl">♟️</div>
              <span
                className={`live-dot absolute -right-1 -top-0.5 h-2 w-2 rounded-full ${
                  connected ? "bg-accent-emerald" : "bg-red-500"
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight sm:text-lg">
                AgenticChess
              </div>
              <div className="hidden text-[10px] uppercase tracking-widest text-[var(--muted)] sm:block">
                {stats.chain} · onchain
              </div>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <StatPill icon={<Hash size={14} />} label="Moves" value={stats.totalMoves} />
            <StatPill icon={<Activity size={14} />} label="Games" value={stats.totalGames} />
            <StatPill
              icon={<span className="mono text-xs">tx</span>}
              label="Onchain"
              value={stats.totalTxns}
              pending={stats.pendingTxns}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setLeaderOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm text-[var(--muted)] transition hover:border-accent-indigo hover:text-[var(--fg)]"
              title="Open leaderboard"
            >
              <Trophy size={14} />
              <span className="hidden lg:inline">Leaderboard</span>
            </button>
            <button
              onClick={toggleLearning}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                learningMode
                  ? "border-accent-indigo bg-accent-indigo/15 text-accent-indigo"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-accent-indigo"
              }`}
              title="Show plain-English explanation for each move"
            >
              <BookOpen size={14} />
              <span className="hidden lg:inline">Learn</span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile stats strip */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)] md:hidden">
          <span className="mono">{stats.chain}</span>
          <span>
            <b className="mono text-[var(--fg)]">{stats.totalMoves.toLocaleString()}</b> moves
          </span>
          <span>
            <b className="mono text-[var(--fg)]">{stats.totalGames.toLocaleString()}</b> games
          </span>
          <span>
            <b className="mono text-accent-emerald">{stats.totalTxns.toLocaleString()}</b> tx
            {stats.pendingTxns > 0 && (
              <span className="mono text-amber-400"> +{stats.pendingTxns}⏳</span>
            )}
          </span>
        </div>
      </header>

      <LeaderboardModal open={leaderOpen} onClose={() => setLeaderOpen(false)} />
    </>
  );
}

function StatPill({
  icon,
  label,
  value,
  pending,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  pending?: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
      <span className="text-[var(--muted)]">{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span className="mono text-sm font-semibold">{value.toLocaleString()}</span>
      {typeof pending === "number" && pending > 0 && (
        <span className="mono text-xs text-amber-400">+{pending} ⏳</span>
      )}
    </div>
  );
}
