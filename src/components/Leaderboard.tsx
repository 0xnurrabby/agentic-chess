"use client";

import { useGameStore } from "@/store/gameStore";
import { Trophy } from "lucide-react";

const PERSONALITY_COLOR: Record<string, string> = {
  RANDOM: "text-gray-400",
  AGGRESSIVE: "text-red-400",
  DEFENSIVE: "text-blue-400",
  POSITIONAL: "text-purple-400",
  TACTICAL: "text-amber-400",
  GRANDMASTER: "text-accent-emerald",
};

export default function Leaderboard() {
  const board = useGameStore((s) => s.leaderboard);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Trophy size={14} className="text-accent-indigo" />
          Agent leaderboard
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          top {board.length}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Agent</th>
              <th className="px-3 py-2 text-left">Style</th>
              <th className="px-3 py-2 text-right">ELO</th>
              <th className="px-3 py-2 text-right">W / L / D</th>
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
                      <span className="font-medium">{a.name}</span>
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-xs ${PERSONALITY_COLOR[a.personality]}`}>
                    {a.personality.toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-right mono font-semibold">{a.elo}</td>
                  <td className="px-3 py-2 text-right mono text-xs">
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
  );
}
