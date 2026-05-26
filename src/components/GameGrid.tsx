"use client";

import { useGameStore } from "@/store/gameStore";
import GameBoard from "./GameBoard";
import { Chess } from "chess.js";

export default function GameGrid() {
  const games = useGameStore((s) => s.games);
  const agents = useGameStore((s) => s.agents);
  const selected = useGameStore((s) => s.selectedGameId);
  const select = useGameStore((s) => s.selectGame);

  // Adapt grid density to active game count — fewer games = bigger thumbnails.
  const n = games.length;
  const colClasses =
    n <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : n <= 4
      ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"
      : n <= 6
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

  return (
    <div className={`grid gap-3 ${colClasses}`}>
      {games.map((g) => {
        const white = agents[g.whiteAgentId];
        const black = agents[g.blackAgentId];
        const isActive = selected === g.id;
        const inCheck = isInCheck(g.fen);
        return (
          <button
            key={g.id}
            onClick={() => select(g.id)}
            className={`group flex flex-col gap-2 rounded-xl border bg-[var(--card)] p-2 text-left transition ${
              isActive
                ? "border-accent-indigo shadow-[0_0_0_2px_rgba(99,102,241,0.35)]"
                : "border-[var(--border)] hover:border-accent-indigo/60"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span className="mono">G{g.id}</span>
              <div className="flex items-center gap-1">
                {inCheck && (
                  <span className="rounded bg-red-500/15 px-1 text-red-400">check</span>
                )}
                <span className="live-dot text-accent-emerald">●</span>
              </div>
            </div>

            <GameBoard game={g} />

            <div className="flex items-center justify-between gap-1 text-xs">
              <div className="flex min-w-0 items-center gap-1">
                <span className="shrink-0">{white?.avatar}</span>
                <span className="mono truncate">{white?.elo ?? "?"}</span>
              </div>
              <span className="mono shrink-0 text-[var(--muted)]">vs</span>
              <div className="flex min-w-0 items-center justify-end gap-1">
                <span className="mono truncate">{black?.elo ?? "?"}</span>
                <span className="shrink-0">{black?.avatar}</span>
              </div>
            </div>

            <div className="mono truncate text-[10px] text-[var(--muted)]">
              move {g.moves.length} · {g.turn === "w" ? "white" : "black"}
            </div>
          </button>
        );
      })}
      {games.length === 0 &&
        Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)]"
          />
        ))}
    </div>
  );
}

function isInCheck(fen: string): boolean {
  try {
    const c = new Chess(fen);
    return c.inCheck();
  } catch {
    return false;
  }
}
