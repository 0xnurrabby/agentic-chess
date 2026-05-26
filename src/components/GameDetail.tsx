"use client";

import { useGameStore } from "@/store/gameStore";
import GameBoard from "./GameBoard";
import AgentCard from "./AgentCard";
import MoveLog from "./MoveLog";
import { Chess } from "chess.js";
import { useMemo } from "react";

export default function GameDetail() {
  const selectedId = useGameStore((s) => s.selectedGameId);
  const games = useGameStore((s) => s.games);
  const agents = useGameStore((s) => s.agents);

  const game = useMemo(() => games.find((g) => g.id === selectedId), [games, selectedId]);
  const fen = game?.fen;

  const captured = useMemo(
    () => (fen ? computeCaptured(fen) : { byWhite: [], byBlack: [] }),
    [fen],
  );
  const inCheck = useMemo(() => {
    if (!fen) return false;
    try {
      return new Chess(fen).inCheck();
    } catch {
      return false;
    }
  }, [fen]);

  if (!game) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
        Pick a game above to see the live view.
      </div>
    );
  }

  const white = agents[game.whiteAgentId];
  const black = agents[game.blackAgentId];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="mono rounded bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--muted)]">
              Game #{game.id}
            </span>
            {game.opening && (
              <span className="rounded bg-accent-indigo/15 px-2 py-0.5 text-xs text-accent-indigo">
                {game.opening}
              </span>
            )}
            {inCheck && (
              <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                check
              </span>
            )}
          </div>
          <div className="shrink-0 text-[11px] text-[var(--muted)]">
            {game.moves.length} moves · {game.turn === "w" ? "white" : "black"} to move
          </div>
        </div>

        <AgentCard agent={black} side="b" active={game.turn === "b" && game.active} />
        <CapturedRow pieces={captured.byBlack} />

        <div className="my-3 mx-auto max-w-[560px]">
          <GameBoard game={game} showCoordinates />
        </div>

        <CapturedRow pieces={captured.byWhite} />
        <AgentCard agent={white} side="w" active={game.turn === "w" && game.active} />
      </div>

      <div className="lg:sticky lg:top-24 lg:h-fit">
        <MoveLog game={game} />
      </div>
    </div>
  );
}

const UNICODE_PIECE: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
};

function CapturedRow({ pieces }: { pieces: string[] }) {
  if (pieces.length === 0) return <div className="h-6" />;
  return (
    <div className="flex h-6 flex-wrap items-center gap-0.5 text-lg text-[var(--muted)]">
      {pieces.map((p, i) => (
        <span key={i}>{UNICODE_PIECE[p] ?? "?"}</span>
      ))}
    </div>
  );
}

function computeCaptured(fen: string) {
  try {
    const c = new Chess(fen);
    const board = c.board();
    const remaining: Record<string, number> = {};
    for (const row of board) {
      for (const cell of row) {
        if (!cell) continue;
        const key = cell.color + cell.type;
        remaining[key] = (remaining[key] ?? 0) + 1;
      }
    }
    const start: Record<string, number> = {
      wp: 8, wn: 2, wb: 2, wr: 2, wq: 1,
      bp: 8, bn: 2, bb: 2, br: 2, bq: 1,
    };
    const byWhite: string[] = [];
    const byBlack: string[] = [];
    for (const k of Object.keys(start)) {
      const lost = start[k] - (remaining[k] ?? 0);
      for (let i = 0; i < lost; i++) {
        if (k.startsWith("b")) byWhite.push(k[1]);
        else byBlack.push(k[1]);
      }
    }
    return { byWhite, byBlack };
  } catch {
    return { byWhite: [], byBlack: [] };
  }
}
