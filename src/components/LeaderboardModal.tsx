"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { Trophy, X } from "lucide-react";

const PERSONALITY_COLOR: Record<string, string> = {
  RANDOM: "text-gray-400",
  AGGRESSIVE: "text-red-400",
  DEFENSIVE: "text-blue-400",
  POSITIONAL: "text-purple-400",
  TACTICAL: "text-amber-400",
  GRANDMASTER: "text-accent-emerald",
};

export default function LeaderboardModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const board = useGameStore((s) => s.leaderboard);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy size={16} className="text-accent-indigo" />
            Agent leaderboard
            <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              top {board.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--bg)]/60 hover:text-[var(--fg)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[var(--card)]">
              <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-left">Style</th>
                <th className="px-3 py-2 text-right">ELO</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">W / L / D</th>
                <th className="px-3 py-2 text-right">Win%</th>
              </tr>
            </thead>
            <tbody>
              {board.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--muted)]">
                    Waiting for the first games to finish…
                  </td>
                </tr>
              )}
              {board.map((a, i) => {
                const total = a.record.wins + a.record.losses + a.record.draws;
                const wr = total === 0 ? 0 : (a.record.wins / total) * 100;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)]/40 last:border-none hover:bg-[var(--bg)]/60"
                  >
                    <td className="px-3 py-2 mono text-[var(--muted)]">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{a.avatar}</span>
                        <span className="truncate font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-xs ${PERSONALITY_COLOR[a.personality]}`}>
                      {a.personality.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right mono font-semibold">{a.elo}</td>
                    <td className="hidden px-3 py-2 text-right mono text-xs sm:table-cell">
                      {a.record.wins} / {a.record.losses} / {a.record.draws}
                    </td>
                    <td className="px-3 py-2 text-right mono text-xs">{wr.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
