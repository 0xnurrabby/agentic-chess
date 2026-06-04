"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "@/types";
import { motion } from "framer-motion";

// react-chessboard pulls in piece SVGs and refers to window — must be client-only.
const Chessboard = dynamic(() => import("react-chessboard").then((m) => m.Chessboard), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full animate-pulse rounded-md bg-[var(--border)]/40" />
  ),
});

// Premium indigo palette — designed to feel native to the site's deep navy +
// indigo theme (--bg #0a0e1a, --indigo #6366f1). Light squares pop just
// enough for piece visibility while the dark squares blend into the page.
const LIGHT_SQUARE = "#c7d2fe"; // indigo-200 — soft lavender
const DARK_SQUARE = "#312e81";  // indigo-900 — deep navy-violet
// Warm amber for last-move — high-contrast against cool indigo, easy to spot.
const LAST_MOVE_LIGHT = "#fcd34d"; // amber-300
const LAST_MOVE_DARK = "#d97706";  // amber-600
const CHECK_GLOW =
  "radial-gradient(ellipse at center, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.55) 35%, rgba(239,68,68,0) 72%)";
// Side ownership rings — green for white, red for black. Inset box-shadow
// composes with last-move `background` and the check radial-gradient.
const WHITE_PIECE_GLOW = "inset 0 0 0 2px rgba(74, 222, 128, 0.55)";  // green-400
const BLACK_PIECE_GLOW = "inset 0 0 0 2px rgba(248, 113, 113, 0.55)"; // red-400
// Outer glow + drop shadow gives the board a "framed" feel against the
// dark page bg.
const BOARD_SHADOW =
  "0 12px 40px rgba(99, 102, 241, 0.22), 0 4px 12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(165, 180, 252, 0.1)";

export default function GameBoard({
  game,
  interactive = false,
  showCoordinates = false,
  highlightLastMove = true,
  forceWidth,
}: {
  game: GameState;
  interactive?: boolean;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
  /** Override the auto-measured width; useful for the full-size detail view. */
  forceWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  // ResizeObserver: react-chessboard needs an explicit pixel width. Without it
  // the board collapses to ~32px.
  useEffect(() => {
    if (forceWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setMeasuredWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [forceWidth]);

  const lastMove = game.moves[game.moves.length - 1];

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Subtle owner ring: green for white pieces, red for black. Helps a
    // beginner instantly read which side controls each square. Uses
    // box-shadow so it composes with the last-move background highlight.
    const occupants = piecesByColor(game.fen);
    for (const sq of occupants.white) {
      styles[sq] = { boxShadow: WHITE_PIECE_GLOW };
    }
    for (const sq of occupants.black) {
      styles[sq] = { boxShadow: BLACK_PIECE_GLOW };
    }

    if (highlightLastMove && lastMove) {
      const from = lastMove.uci.slice(0, 2);
      const to = lastMove.uci.slice(2, 4);
      // Indigo highlight on the move squares.
      styles[from] = {
        ...styles[from],
        background: isLightSquare(from) ? LAST_MOVE_LIGHT : LAST_MOVE_DARK,
      };
      styles[to] = {
        ...styles[to],
        background: isLightSquare(to) ? LAST_MOVE_LIGHT : LAST_MOVE_DARK,
      };
    }
    // Mark king's square red when in check (game.fen is post-move).
    if (game.moves.length > 0) {
      const kingSquare = findKingInCheck(game.fen);
      if (kingSquare) {
        styles[kingSquare] = {
          ...styles[kingSquare],
          background: CHECK_GLOW,
        };
      }
    }
    return styles;
  }, [highlightLastMove, lastMove, game.fen, game.moves.length]);

  const boardWidth = forceWidth ?? measuredWidth;
  const moveOverlay = useMemo(() => {
    if (!lastMove || boardWidth <= 0) return null;
    const from = squareCenter(lastMove.uci.slice(0, 2), boardWidth);
    const to = squareCenter(lastMove.uci.slice(2, 4), boardWidth);
    if (!from || !to) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { from, to, len, angle, key: `${game.id}-${lastMove.moveNumber}-${lastMove.uci}` };
  }, [boardWidth, game.id, lastMove]);

  return (
    <div ref={containerRef} className="w-full">
      {boardWidth > 0 ? (
        <div className="relative">
          <Chessboard
            position={game.fen}
            boardWidth={boardWidth}
            arePiecesDraggable={interactive}
            showBoardNotation={showCoordinates}
            customSquareStyles={customSquareStyles}
            customDarkSquareStyle={{ backgroundColor: DARK_SQUARE }}
            customLightSquareStyle={{ backgroundColor: LIGHT_SQUARE }}
            customBoardStyle={{
              borderRadius: 10,
              boxShadow: BOARD_SHADOW,
            }}
            animationDuration={420}
          />
          {moveOverlay && (
            <motion.div
              key={moveOverlay.key}
              className="pointer-events-none absolute left-0 top-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="absolute h-2 rounded-full bg-amber-300/80 shadow-[0_0_14px_rgba(252,211,77,0.75)]"
                style={{
                  left: moveOverlay.from.x,
                  top: moveOverlay.from.y,
                  width: moveOverlay.len,
                  transformOrigin: "0 50%",
                  rotate: `${moveOverlay.angle}deg`,
                  translateY: "-50%",
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.span
                className="absolute h-4 w-4 rounded-full border-2 border-amber-200 bg-amber-300/30 shadow-[0_0_18px_rgba(252,211,77,0.85)]"
                style={{
                  left: moveOverlay.to.x,
                  top: moveOverlay.to.y,
                  translateX: "-50%",
                  translateY: "-50%",
                }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.35, 1], opacity: [0, 1, 0.9] }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            </motion.div>
          )}
        </div>
      ) : (
        <div className="aspect-square w-full animate-pulse rounded-md bg-[var(--border)]/40" />
      )}
    </div>
  );
}

function squareCenter(square: string, boardWidth: number): { x: number; y: number } | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const size = boardWidth / 8;
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10);
  return {
    x: file * size + size / 2,
    y: (8 - rank) * size + size / 2,
  };
}

function isLightSquare(square: string): boolean {
  // a1 is dark; alternates. file + rank parity → dark if (fileIdx + rank) odd.
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1;
  return (file + rank) % 2 === 1;
}

/**
 * Parse the FEN board position into two lists of squares — one per side.
 * Pure string parsing so we don't pull chess.js into this hot path. FEN's
 * piece-placement field uses uppercase for white, lowercase for black; digits
 * for runs of empty squares; "/" between ranks (rank 8 first).
 */
function piecesByColor(fen: string): { white: string[]; black: string[] } {
  const white: string[] = [];
  const black: string[] = [];
  const placement = fen.split(" ")[0] ?? "";
  const ranks = placement.split("/");
  for (let r = 0; r < ranks.length && r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= "1" && ch <= "8") {
        file += parseInt(ch, 10);
        continue;
      }
      const square = String.fromCharCode("a".charCodeAt(0) + file) + (8 - r);
      if (ch === ch.toUpperCase()) white.push(square);
      else black.push(square);
      file += 1;
    }
  }
  return { white, black };
}

// Inline tiny FEN-king-in-check finder — avoid importing chess.js into a client
// component just for this. We only need: "if anyone is in check, which square
// is the friendly king on?"
function findKingInCheck(fen: string): string | null {
  try {
    // Lazy import via require would pull chess.js client-side which is fine,
    // but we already import it elsewhere. Use a dynamic import via require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Chess } = require("chess.js");
    const c = new Chess(fen);
    if (!c.inCheck()) return null;
    const turn = c.turn(); // side to move is the one in check
    const board = c.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.type === "k" && cell.color === turn) {
          const file = String.fromCharCode("a".charCodeAt(0) + f);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
