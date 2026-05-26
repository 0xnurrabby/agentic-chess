import { Chess, Move } from "chess.js";
import { Personality } from "@/types";
import type { AnnotationData, AnnotationKind } from "@/types";
import { renderAnnotation } from "@/i18n/annotations";
import { pick } from "@/lib/utils";

/**
 * Heuristic move engine. Personality-aware. No external binaries needed —
 * runs equally well in Node serverless and at the edge.
 *
 * Each personality scores candidate moves differently. RANDOM picks a legal
 * move uniformly; GRANDMASTER does a shallow 2-ply minimax. The middle
 * personalities are 1-ply weighted heuristics that play visibly distinct
 * styles (sacrifices vs. solid vs. positional).
 */

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Center-control bonus
const CENTER_SQUARES = new Set(["d4", "d5", "e4", "e5"]);
const EXTENDED_CENTER = new Set([
  "c3", "c4", "c5", "c6", "d3", "d6", "e3", "e6", "f3", "f4", "f5", "f6",
]);

function materialEval(chess: Chess): number {
  // From white's perspective.
  const board = chess.board();
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const val = PIECE_VALUE[cell.type] ?? 0;
      score += cell.color === "w" ? val : -val;
    }
  }
  return score;
}

function squareCenterBonus(sq: string): number {
  if (CENTER_SQUARES.has(sq)) return 25;
  if (EXTENDED_CENTER.has(sq)) return 10;
  return 0;
}

/** Score a move 1-ply, from the moving side's perspective. Higher = better. */
function scoreMove(
  chess: Chess,
  move: Move,
  personality: Personality,
): number {
  let s = 0;

  // Captures: value of captured piece. Tactical / Aggressive bias higher.
  if (move.captured) {
    const capValue = PIECE_VALUE[move.captured] ?? 0;
    const attackerValue = PIECE_VALUE[move.piece] ?? 0;
    const trade = capValue - attackerValue / 10;
    if (personality === "AGGRESSIVE") s += trade * 1.4;
    else if (personality === "TACTICAL") s += trade * 1.3;
    else if (personality === "DEFENSIVE") s += capValue >= attackerValue ? trade : trade * 0.6;
    else s += trade;
  }

  // Check delivery.
  if (move.san.endsWith("+")) {
    if (personality === "AGGRESSIVE") s += 80;
    else if (personality === "TACTICAL") s += 60;
    else s += 30;
  }
  if (move.san.endsWith("#")) s += 100000;

  // Promotion.
  if (move.promotion) s += 600;

  // Castling — defensive / positional value it; aggressive less so.
  if (move.san === "O-O" || move.san === "O-O-O") {
    if (personality === "DEFENSIVE") s += 90;
    else if (personality === "POSITIONAL") s += 70;
    else s += 40;
  }

  // Center control: positional / GM care most.
  const centerBonus = squareCenterBonus(move.to);
  if (personality === "POSITIONAL") s += centerBonus * 1.6;
  else if (personality === "GRANDMASTER") s += centerBonus * 1.4;
  else if (personality === "DEFENSIVE") s += centerBonus * 0.8;
  else s += centerBonus;

  // Developing knights/bishops in opening.
  if (
    chess.moveNumber() <= 12 &&
    (move.piece === "n" || move.piece === "b") &&
    (move.from.endsWith("1") || move.from.endsWith("8"))
  ) {
    s += personality === "POSITIONAL" || personality === "GRANDMASTER" ? 35 : 20;
  }

  // Defensive: penalize moving the queen out early.
  if (
    personality === "DEFENSIVE" &&
    move.piece === "q" &&
    chess.moveNumber() <= 8
  ) {
    s -= 40;
  }

  // Aggressive: bonus for moves into enemy half.
  if (personality === "AGGRESSIVE") {
    const rank = parseInt(move.to[1], 10);
    const myColor = move.color;
    if ((myColor === "w" && rank >= 5) || (myColor === "b" && rank <= 4)) {
      s += 25;
    }
  }

  // Tiny noise so equal scores still vary.
  s += Math.random() * 5;

  return s;
}

function searchTwoPly(chess: Chess, move: Move, perspective: "w" | "b"): number {
  // After we make this move, score the opponent's best reply and subtract.
  chess.move(move);
  if (chess.isGameOver()) {
    let v = 0;
    if (chess.isCheckmate()) {
      // We just delivered mate.
      v = 999999;
    } else {
      v = 0; // draw
    }
    chess.undo();
    return v;
  }

  const replies = chess.moves({ verbose: true }) as Move[];
  let worst = -Infinity;
  for (const r of replies) {
    chess.move(r);
    const mat = materialEval(chess) * (perspective === "w" ? 1 : -1);
    chess.undo();
    if (mat > worst) worst = mat;
  }
  chess.undo();
  return -worst;
}

export interface PickedMove {
  uci: string;
  san: string;
  move: Move;
}

export function pickMove(fen: string, personality: Personality): PickedMove | null {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true }) as Move[];
  if (legal.length === 0) return null;

  if (personality === "RANDOM") {
    const m = pick(legal);
    return { uci: m.from + m.to + (m.promotion ?? ""), san: m.san, move: m };
  }

  // Score every legal move 1-ply.
  const scored = legal.map((m) => ({ m, s: scoreMove(chess, m, personality) }));

  // GRANDMASTER: re-score top-N candidates with a 2-ply lookahead.
  if (personality === "GRANDMASTER") {
    scored.sort((a, b) => b.s - a.s);
    const top = scored.slice(0, Math.min(6, scored.length));
    const perspective = chess.turn();
    for (const t of top) {
      t.s += searchTwoPly(chess, t.m, perspective) * 0.1;
    }
    top.sort((a, b) => b.s - a.s);
    const chosen = top[0].m;
    return {
      uci: chosen.from + chosen.to + (chosen.promotion ?? ""),
      san: chosen.san,
      move: chosen,
    };
  }

  // Otherwise pick softmax over the top moves so play isn't deterministic.
  scored.sort((a, b) => b.s - a.s);
  const topN = scored.slice(0, Math.min(5, scored.length));
  const temperature = personality === "TACTICAL" ? 30 : 50;
  const weights = topN.map((t) => Math.exp(t.s / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < topN.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      const chosen = topN[i].m;
      return {
        uci: chosen.from + chosen.to + (chosen.promotion ?? ""),
        san: chosen.san,
        move: chosen,
      };
    }
  }
  const fallback = topN[0].m;
  return {
    uci: fallback.from + fallback.to + (fallback.promotion ?? ""),
    san: fallback.san,
    move: fallback,
  };
}

// ---------------------------------------------------------------
// Learning-mode annotations — light, rule-based, never AI-call.
// Every annotation explains HOW the moving piece moves PLUS what this
// specific move achieves. Beginner-friendly first, agent-behavior second.
//
// The classification logic lives here and produces a structured
// AnnotationData. The actual text (in any language) is rendered by
// `renderAnnotation` from `@/i18n/annotations` — that way the same data
// can be displayed in English, Bangla, Hindi, Chinese, or Russian
// without re-running this engine.
// ---------------------------------------------------------------

const OPENINGS: Array<{ moves: string[]; name: string }> = [
  { moves: ["e4", "e5"], name: "Open Game" },
  { moves: ["e4", "c5"], name: "Sicilian Defense" },
  { moves: ["e4", "e6"], name: "French Defense" },
  { moves: ["e4", "c6"], name: "Caro-Kann Defense" },
  { moves: ["e4", "d5"], name: "Scandinavian Defense" },
  { moves: ["d4", "d5"], name: "Closed Game" },
  { moves: ["d4", "Nf6"], name: "Indian Defense" },
  { moves: ["d4", "f5"], name: "Dutch Defense" },
  { moves: ["c4"], name: "English Opening" },
  { moves: ["Nf3"], name: "Réti Opening" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"], name: "Ruy López" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], name: "Italian Game" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "d4"], name: "Scotch Game" },
  { moves: ["e4", "c5", "Nf3", "d6"], name: "Sicilian Najdorf-bound" },
];

export function detectOpening(sanMoves: string[]): string | undefined {
  let best: string | undefined;
  let bestLen = 0;
  for (const o of OPENINGS) {
    if (o.moves.length > sanMoves.length) continue;
    let match = true;
    for (let i = 0; i < o.moves.length; i++) {
      if (sanMoves[i] !== o.moves[i]) {
        match = false;
        break;
      }
    }
    if (match && o.moves.length > bestLen) {
      best = o.name;
      bestLen = o.moves.length;
    }
  }
  return best;
}

/**
 * Classifies the move into a structured AnnotationData. The kind picks
 * the educational sentence ("checkmate", "develop", "capGain", …) and
 * params carry the variable bits (destination square, captured piece,
 * etc). Returns undefined only if the input is malformed.
 *
 * The personality argument is accepted so the signature stays stable —
 * styling differences are handled by the move-selection code, not the
 * commentary.
 */
export function buildAnnotationData(
  fenBefore: string,
  move: Move,
  movesSoFar: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  personality: Personality = "RANDOM",
): AnnotationData | undefined {
  const moveNo = movesSoFar.length + 1;
  let kind: AnnotationKind;
  let captured: string | undefined;
  let promotion: string | undefined;
  let check: boolean | undefined;
  let to: string | undefined = move.to;

  if (move.san.endsWith("#")) {
    kind = "checkmate";
    to = undefined;
  } else if (move.san === "O-O") {
    kind = "castleK";
    to = undefined;
  } else if (move.san === "O-O-O") {
    kind = "castleQ";
    to = undefined;
  } else if (move.promotion) {
    kind = "promotion";
    promotion = move.promotion;
  } else if (move.flags.includes("e")) {
    kind = "enpassant";
  } else if (move.captured) {
    captured = move.captured;
    const capV = PIECE_VALUE[move.captured] ?? 0;
    const ourV = PIECE_VALUE[move.piece] ?? 0;
    check = move.san.endsWith("+");
    if (capV > ourV + 50) kind = "capGain";
    else if (capV + 50 < ourV) kind = "capSac";
    else kind = "capEven";
  } else if (move.san.endsWith("+")) {
    kind = "check";
  } else if (CENTER_SQUARES.has(move.to)) {
    kind = "center";
  } else if (
    moveNo <= 14 &&
    (move.piece === "n" || move.piece === "b") &&
    (move.from.endsWith("1") || move.from.endsWith("8"))
  ) {
    kind = "develop";
  } else if (
    move.piece === "p" &&
    (move.to[1] === "4" || move.to[1] === "5") &&
    moveNo <= 8
  ) {
    kind = "claimCenter";
  } else if (move.piece === "q" && moveNo <= 8) {
    kind = "earlyQueen";
  } else if (move.piece === "k" && moveNo > 24) {
    kind = "kingEndgame";
  } else if (EXTENDED_CENTER.has(move.to)) {
    kind = "nearCenter";
  } else {
    kind = "quiet";
  }

  let opening: string | undefined;
  if (moveNo <= 10) {
    const o = detectOpening(movesSoFar);
    if (o) opening = o;
  }

  return {
    piece: move.piece,
    kind,
    to,
    captured,
    promotion,
    check,
    opening,
  };
}

/**
 * Backwards-compatible English string form. Built from the same
 * structured data the client uses to render other languages.
 */
export function annotateMove(
  fenBefore: string,
  move: Move,
  movesSoFar: string[],
  personality: Personality = "RANDOM",
): string | undefined {
  const data = buildAnnotationData(fenBefore, move, movesSoFar, personality);
  if (!data) return undefined;
  return renderAnnotation(data, "en");
}
