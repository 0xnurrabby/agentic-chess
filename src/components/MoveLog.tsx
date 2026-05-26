"use client";

import { useGameStore } from "@/store/gameStore";
import TxnBadge from "./TxnBadge";
import type { GameState, MoveRecord } from "@/types";
import { useEffect, useRef } from "react";

const VISIBLE_BUFFER = 100; // render at most this many moves in the DOM

// Side colors — mirror the green/red piece halos on the board so a viewer
// can instantly tell which side is which without reading the labels.
const WHITE_TONE = "rgba(74, 222, 128, 1)";       // green-400
const WHITE_BORDER = "rgba(74, 222, 128, 0.55)";  // softer for left border
const WHITE_ANNOTATION = "rgba(134, 239, 172, 0.95)"; // green-300
const BLACK_TONE = "rgba(248, 113, 113, 1)";       // red-400
const BLACK_BORDER = "rgba(248, 113, 113, 0.55)";
const BLACK_ANNOTATION = "rgba(252, 165, 165, 0.95)"; // red-300

export default function MoveLog({ game }: { game: GameState }) {
  const agents = useGameStore((s) => s.agents);
  const learningMode = useGameStore((s) => s.learningMode);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top (latest move) when a new move arrives.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [game.moves.length]);

  // Render only the last N moves to keep the DOM light.
  const visibleMoves: MoveRecord[] =
    game.moves.length > VISIBLE_BUFFER
      ? game.moves.slice(-VISIBLE_BUFFER)
      : game.moves;
  const truncated = game.moves.length - visibleMoves.length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <div className="text-sm font-semibold">Move log</div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="mono text-[var(--muted)]">
            {game.moves.length} {game.moves.length === 1 ? "move" : "moves"}
            {game.opening ? ` · ${game.opening}` : ""}
          </span>
          <span className="flex items-center gap-1.5 mono">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: WHITE_TONE }}
            />
            <span style={{ color: WHITE_TONE }}>White</span>
            <span
              className="ml-1 inline-block h-2 w-2 rounded-full"
              style={{ background: BLACK_TONE }}
            />
            <span style={{ color: BLACK_TONE }}>Black</span>
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2"
        // Strict max so the column never drives the page taller than the board.
        style={{ maxHeight: "560px" }}
      >
        {game.moves.length === 0 && (
          <div className="py-6 text-center text-xs text-[var(--muted)]">
            Awaiting first move…
          </div>
        )}
        <ul className="flex flex-col-reverse gap-1">
          {visibleMoves.map((m) => {
            const a = agents[m.by];
            const isWhite = m.color === "w";
            const sideTone = isWhite ? WHITE_TONE : BLACK_TONE;
            const sideBorder = isWhite ? WHITE_BORDER : BLACK_BORDER;
            const sideAnnotation = isWhite ? WHITE_ANNOTATION : BLACK_ANNOTATION;
            return (
              <li
                key={m.moveNumber}
                className="flex flex-wrap items-center gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-xs hover:bg-[var(--bg)]/60"
                style={{ borderLeftColor: sideBorder }}
              >
                <span className="mono w-6 shrink-0 text-right text-[var(--muted)]">
                  {Math.ceil(m.moveNumber / 2)}
                  {isWhite ? "." : "…"}
                </span>
                <span
                  className="mono w-14 shrink-0 font-semibold"
                  style={{ color: sideTone }}
                >
                  {m.san}
                </span>
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ color: a?.color ?? "var(--fg)" }}
                  title={a?.name}
                >
                  {a?.avatar} {a?.name}
                </span>
                <div className="shrink-0">
                  <TxnBadge move={m} />
                </div>
                {learningMode && m.annotation && (
                  <div
                    className="basis-full pl-9 pr-2 pt-0.5 text-[11px] italic leading-snug"
                    style={{ color: sideAnnotation }}
                  >
                    {m.annotation}
                  </div>
                )}
              </li>
            );
          })}
          {truncated > 0 && (
            <li className="px-2 py-2 text-center text-[10px] text-[var(--muted)]">
              … {truncated} earlier moves not shown
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
