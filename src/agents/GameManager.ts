import { Chess, Move } from "chess.js";
import { Agent, GameResult, GameState, MoveRecord, PlatformStats } from "@/types";
import { getPool, matchAgents, saveAgent, flush } from "./AgentPool";
import { recordResult } from "./Agent";
import { annotateMove, detectOpening, pickMove } from "./MoveEngine";
import {
  sendMoveTxn,
  sendStartGameTxn,
  sendEndGameTxn,
  isMockMode,
} from "@/blockchain/sendMove";
import { getAgentWalletAddress } from "@/blockchain/walletPool";
import {
  getOnchainTotalGames,
  isOnchainGameSlotTaken,
  getOnchainGame,
} from "@/blockchain/readChain";

function numGames(): number {
  const raw = process.env.NUM_GAMES;
  const n = raw ? parseInt(raw, 10) : 10;
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 20);
}

/**
 * Master on/off switch via `GAME_ENABLED` env var.
 *   - "on" / "true" / "1" / "yes" (or unset) → game runs normally
 *   - "off" / "false" / "0" / "no" → all game progression is frozen
 *
 * When off, runTick is a no-op: no new games are started, in-flight games
 * stop ticking, and chain submissions stop firing. In-memory game state is
 * preserved untouched so flipping back to "on" picks up from the same FENs.
 * On Vercel, new deployments inherit chain state via the totalGames bootstrap
 * either way — so "off" deploys really just stop spending CDP ops.
 */
function isGameEnabled(): boolean {
  const v = (process.env.GAME_ENABLED ?? "on").toLowerCase().trim();
  if (v === "off" || v === "false" || v === "0" || v === "no") return false;
  return true;
}

const MAX_MOVES = 200;
const DEFAULT_MIN_MOVE_DELAY_MS = 1800;
const DEFAULT_MAX_MOVE_DELAY_MS = 4500;
const HISTORY_LIMIT = 50;

function moveDelayRange(): [number, number] {
  const minRaw = process.env.MIN_MOVE_DELAY_MS;
  const maxRaw = process.env.MAX_MOVE_DELAY_MS;
  const minN = minRaw ? parseInt(minRaw, 10) : DEFAULT_MIN_MOVE_DELAY_MS;
  const maxN = maxRaw ? parseInt(maxRaw, 10) : DEFAULT_MAX_MOVE_DELAY_MS;
  // Sanitize: enforce minimum gap and ordering.
  const min = Number.isFinite(minN) && minN >= 200 ? minN : DEFAULT_MIN_MOVE_DELAY_MS;
  const max = Number.isFinite(maxN) && maxN >= min ? maxN : Math.max(min, DEFAULT_MAX_MOVE_DELAY_MS);
  return [min, max];
}

interface ManagerState {
  games: Map<number, GameState>;
  history: GameState[];
  nextGameId: number;
  bootstrapped: boolean;
  stats: PlatformStats;
  lastTickAt: number;
  nextTickAt: Map<number, number>;
  starting: Set<string>;
  // Re-entrancy guard for runTick. The SSE stream and the cron route can call
  // runTick concurrently; without this, two ticks both filter the same "due"
  // games and submit duplicate moves with the same color, breaking the
  // contract's strict turn-order check.
  tickInProgress: boolean;
  // Per-game serial tx queue — chain submissions so the contract sees moves
  // strictly in order (it checks msg.sender against moveCount parity).
  txQueue: Map<number, Promise<unknown>>;
  // Per-agent serial tx queue — CDP rejects parallel UserOps from the same
  // smart account. With 1:1 agent↔wallet mapping each agent has one queue.
  agentTxQueue: Map<string, Promise<unknown>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __agenticChess: ManagerState | undefined;
}

function chain(): string {
  return process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia";
}

function freshStats(): PlatformStats {
  return {
    totalGames: 0,
    totalMoves: 0,
    totalTxns: 0,
    pendingTxns: 0,
    chain: chain(),
  };
}

function getState(): ManagerState {
  if (!global.__agenticChess) {
    global.__agenticChess = {
      games: new Map(),
      history: [],
      nextGameId: 1,
      bootstrapped: false,
      stats: freshStats(),
      lastTickAt: 0,
      nextTickAt: new Map(),
      starting: new Set(),
      tickInProgress: false,
      txQueue: new Map(),
      agentTxQueue: new Map(),
    };
  }
  return global.__agenticChess!;
}

/**
 * One-time bootstrap: align nextGameId with the contract's totalGames so a
 * fresh server process (which resets the in-memory counter to 1) doesn't
 * collide with games already recorded on chain from a previous run.
 * In mock mode this is a no-op.
 */
async function ensureBootstrapped(state: ManagerState) {
  if (state.bootstrapped) return;
  state.bootstrapped = true; // set first so concurrent ticks don't all try
  if (isMockMode()) return;
  const total = await getOnchainTotalGames();
  if (total == null) return;
  const next = Number(total) + 1;
  if (next > state.nextGameId) {
    state.nextGameId = next;
    console.log(`[GM] bootstrapped nextGameId=${next} from chain (totalGames=${total})`);
  }
}

function newTickGap() {
  const [min, max] = moveDelayRange();
  return min + Math.random() * (max - min);
}

/**
 * Chain a chain-tx onto BOTH the gameId queue and the agentId queue so:
 *   1. The contract sees moves for a game strictly in order (it enforces
 *      msg.sender against moveCount parity).
 *   2. The CDP bundler never sees two parallel UserOps for the same smart
 *      account — each agent owns its smart account 1:1.
 * Both predecessors must settle before the new task runs.
 */
function enqueueGameTxn<T>(
  state: ManagerState,
  gameId: number,
  agentId: string,
  task: () => Promise<T>,
): Promise<T> {
  const gamePrev = state.txQueue.get(gameId) ?? Promise.resolve();
  const agentPrev = state.agentTxQueue.get(agentId) ?? Promise.resolve();
  const next = Promise.allSettled([gamePrev, agentPrev]).then(task);
  state.txQueue.set(gameId, next);
  state.agentTxQueue.set(agentId, next);
  // Best-effort cleanup once the chain settles.
  next.finally(() => {
    if (state.txQueue.get(gameId) === next) state.txQueue.delete(gameId);
    if (state.agentTxQueue.get(agentId) === next) {
      state.agentTxQueue.delete(agentId);
    }
  });
  return next;
}

/**
 * Make sure the persona's stored walletAddress reflects its real CDP smart
 * account before we record startGame onchain (the contract stores the address
 * we pass and checks msg.sender against it for every later move/end txn).
 * In mock mode the existing mock address stays.
 */
async function ensureRealAddress(agent: Agent): Promise<Agent> {
  if (isMockMode()) return agent;
  try {
    const realAddr = await getAgentWalletAddress(agent.id);
    if (agent.walletAddress.toLowerCase() !== realAddr.toLowerCase()) {
      agent.walletAddress = realAddr;
      saveAgent(agent);
    }
    return agent;
  } catch (err) {
    console.warn(
      `[GM] could not provision smart account for ${agent.id}:`,
      (err as Error)?.message ?? err,
    );
    throw err;
  }
}

async function startNewGame(state: ManagerState) {
  const inUse = new Set<string>();
  for (const g of state.games.values()) {
    inUse.add(g.whiteAgentId);
    inUse.add(g.blackAgentId);
  }

  const pair = matchAgents(inUse);
  if (!pair) return;
  let [a, b] = pair;

  // Coin-flip colors.
  let white: Agent;
  let black: Agent;
  if (Math.random() < 0.5) {
    white = a;
    black = b;
  } else {
    white = b;
    black = a;
  }

  // Provision the two agents' smart accounts BEFORE recording startGame on
  // chain so the contract stores the actual smart-account addresses.
  try {
    white = await ensureRealAddress(white);
    black = await ensureRealAddress(black);
  } catch {
    // provisioning failed — bail; refill loop will retry next tick
    return;
  }

  // Claim a free gameId. nextGameId++ is sync and atomic in JS — concurrent
  // ticks always get distinct ids. Verify the slot isn't already claimed on
  // chain (stale RPC, other processes) before committing locally; cap retries.
  let id = state.nextGameId++;
  if (!isMockMode()) {
    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await isOnchainGameSlotTaken(id))) break;
      console.log(`[GM] gameId ${id} taken on chain, advancing`);
      id = state.nextGameId++;
    }
  }

  const chess = new Chess();
  const game: GameState = {
    id,
    whiteAgentId: white.id,
    blackAgentId: black.id,
    fen: chess.fen(),
    pgn: chess.pgn(),
    moves: [],
    turn: "w",
    active: true,
    result: "*",
    startedAt: Date.now(),
    lastMoveAt: Date.now(),
  };

  state.games.set(id, game);
  state.nextTickAt.set(id, Date.now() + newTickGap());

  enqueueGameTxn(state, id, white.id, () =>
    sendStartGameTxn(id, white.walletAddress, black.walletAddress, white.id),
  )
    .then((res) => {
      // If startGame didn't land on chain (most common: another Vercel
      // instance won the gameId race and chain reverted with "exists"),
      // tear down the local game right now. Otherwise tickGame would
      // happily enqueue a playMove that's guaranteed to revert with
      // "not an agent" — wasting CDP ops and surfacing as failed badges
      // in the UI.
      if (res.status === "failed") {
        console.log(`[GM] game ${id} startGame failed — abandoning local immediately`);
        const local = state.games.get(id);
        if (local) {
          local.active = false;
          state.games.delete(id);
          state.nextTickAt.delete(id);
        }
      }
    })
    .catch((e) =>
      console.warn(`[GM] startGame txn error for game ${id}:`, e?.message ?? e),
    );
}

function endGame(state: ManagerState, game: GameState, result: GameResult) {
  game.active = false;
  game.result = result;
  game.endedAt = Date.now();

  const pool = getPool();
  const white = pool.get(game.whiteAgentId);
  const black = pool.get(game.blackAgentId);
  if (!white || !black) {
    state.games.delete(game.id);
    return;
  }

  let whiteOutcome: "win" | "loss" | "draw" = "draw";
  let blackOutcome: "win" | "loss" | "draw" = "draw";
  let winnerAddr: `0x${string}` = "0x0000000000000000000000000000000000000000";
  let signerAgentId = white.id;

  if (result === "1-0") {
    whiteOutcome = "win";
    blackOutcome = "loss";
    game.winnerAgentId = white.id;
    winnerAddr = white.walletAddress;
    signerAgentId = white.id;
  } else if (result === "0-1") {
    whiteOutcome = "loss";
    blackOutcome = "win";
    game.winnerAgentId = black.id;
    winnerAddr = black.walletAddress;
    signerAgentId = black.id;
  }

  saveAgent(recordResult(white, whiteOutcome, black.elo));
  saveAgent(recordResult(black, blackOutcome, white.elo));
  flush();

  state.history.unshift(structuredClone(game));
  if (state.history.length > HISTORY_LIMIT) {
    state.history.length = HISTORY_LIMIT;
  }

  enqueueGameTxn(state, game.id, signerAgentId, () =>
    sendEndGameTxn(game.id, winnerAddr, result, signerAgentId),
  ).catch((e) =>
    console.warn(`[GM] endGame txn failed for game ${game.id}:`, e?.message ?? e),
  );

  state.games.delete(game.id);
}

/**
 * Resync local game state with the contract when local has advanced past
 * what chain has actually recorded. This happens when a playMove UserOp fails
 * at the bundler (paymaster hiccup, fee estimation race, or cross-account
 * ordering between white and black smart accounts). Without this resync, one
 * failed move cascades into "white turn"/"black turn" errors for the rest of
 * the game.
 *
 * Also handles two boundary cases:
 *   - Chain has no record of this game (startGame failed permanently): abandon
 *     locally so the refill loop can claim a fresh gameId.
 *   - Chain has the game marked inactive (endGame already happened — possibly
 *     from a delayed earlier session): close local so we stop submitting.
 *
 * Skips if a chain submission for this game is still pending — in that case
 * chain may legitimately be one behind and will catch up shortly.
 */
async function syncGameFromChain(state: ManagerState, game: GameState) {
  if (isMockMode()) return;
  if (state.txQueue.has(game.id)) return; // pending submission may still settle
  const onchain = await getOnchainGame(game.id);
  if (!onchain) return;

  // startGame never made it to chain — there's nothing for playMove to
  // attach to. Abandon the local game; the refill loop will claim a fresh id.
  if (
    onchain.whiteAgent === "0x0000000000000000000000000000000000000000"
  ) {
    console.log(`[GM] game ${game.id} not recorded on chain — abandoning local`);
    game.active = false;
    state.games.delete(game.id);
    state.nextTickAt.delete(game.id);
    return;
  }

  // Chain has a record — but verify it belongs to OUR agents. On Vercel
  // serverless multiple function instances can bootstrap to the same
  // nextGameId; one wins the slot, the others "exist" but with different
  // agent addresses, and every subsequent playMove from the loser reverts
  // with "not an agent". Drop the local game so the refill loop can claim
  // a fresh id with no collision.
  const pool = getPool();
  const localWhite = pool.get(game.whiteAgentId);
  const localBlack = pool.get(game.blackAgentId);
  if (
    localWhite &&
    onchain.whiteAgent.toLowerCase() !==
      localWhite.walletAddress.toLowerCase()
  ) {
    console.log(
      `[GM] game ${game.id} on chain owned by different agents (chain white=${onchain.whiteAgent}, local=${localWhite.walletAddress}) — abandoning`,
    );
    game.active = false;
    state.games.delete(game.id);
    state.nextTickAt.delete(game.id);
    return;
  }
  if (
    localBlack &&
    onchain.blackAgent.toLowerCase() !==
      localBlack.walletAddress.toLowerCase()
  ) {
    console.log(
      `[GM] game ${game.id} on chain has different black address — abandoning`,
    );
    game.active = false;
    state.games.delete(game.id);
    state.nextTickAt.delete(game.id);
    return;
  }

  // Chain side has already ended the game; stop submitting moves.
  if (!onchain.active) {
    console.log(`[GM] game ${game.id} inactive on chain — closing local`);
    game.active = false;
    state.games.delete(game.id);
    state.nextTickAt.delete(game.id);
    return;
  }

  const chainCount = Number(onchain.moveCount);
  if (chainCount === game.moves.length) return; // in sync
  if (chainCount > game.moves.length) return; // chain ahead is impossible
  // Chain is behind local. Mark local moves past chainCount as failed and
  // rewind game state to what the contract actually recorded.
  for (let i = chainCount; i < game.moves.length; i++) {
    if (game.moves[i].txStatus !== "confirmed") {
      game.moves[i].txStatus = "failed";
    }
  }
  console.log(
    `[GM] resync game ${game.id}: local moves=${game.moves.length}, chain moveCount=${chainCount} — rewinding`,
  );
  game.moves.length = chainCount;
  game.fen = onchain.currentFen;
  game.turn = chainCount % 2 === 0 ? "w" : "b";
  // Rebuild PGN from remaining moves so the move log stays consistent.
  const chess = new Chess();
  for (const m of game.moves) {
    try {
      chess.move(m.san);
    } catch {
      // unparseable — skip, PGN will be partial
    }
  }
  game.pgn = chess.pgn();
}

async function tickGame(state: ManagerState, game: GameState) {
  if (!game.active) return;

  // Don't queue a new move while a prior chain submission for this game is
  // still in flight. Otherwise we'd pick a move from local state that's
  // already past what chain has committed, and that submission is
  // guaranteed to revert with "white turn" / "black turn" once chain
  // processes them out of order. Defer the tick; we'll re-check soon.
  if (state.txQueue.has(game.id)) {
    state.nextTickAt.set(game.id, Date.now() + 1500);
    return;
  }

  // Align local with chain before picking the next move. Self-heals cascades
  // from a single failed playMove UserOp. May abandon the game if startGame
  // never landed on chain, or close it if chain already ended it.
  await syncGameFromChain(state, game);
  if (!game.active) return;

  const chess = new Chess(game.fen);
  if (chess.isGameOver()) {
    let result: GameResult = "1/2-1/2";
    if (chess.isCheckmate()) {
      result = chess.turn() === "w" ? "0-1" : "1-0";
    }
    endGame(state, game, result);
    return;
  }

  if (game.moves.length >= MAX_MOVES) {
    endGame(state, game, "1/2-1/2");
    return;
  }

  const moverColor = chess.turn();
  const moverId = moverColor === "w" ? game.whiteAgentId : game.blackAgentId;
  const pool = getPool();
  const mover = pool.get(moverId);
  if (!mover) return;

  const picked = pickMove(game.fen, mover.personality);
  if (!picked) {
    endGame(state, game, "1/2-1/2");
    return;
  }

  const fenBefore = game.fen;
  const result: Move | null = chess.move(
    picked.uci.length === 5
      ? { from: picked.uci.slice(0, 2), to: picked.uci.slice(2, 4), promotion: picked.uci[4] }
      : { from: picked.uci.slice(0, 2), to: picked.uci.slice(2, 4) },
  );

  if (!result) {
    state.nextTickAt.set(game.id, Date.now() + newTickGap());
    return;
  }

  const fenAfter = chess.fen();
  const sanList = chess.history();
  const opening = detectOpening(sanList);
  if (opening) game.opening = opening;

  const moveNo = game.moves.length + 1;
  const record: MoveRecord = {
    moveNumber: moveNo,
    uci: picked.uci,
    san: picked.san,
    fenAfter,
    by: mover.id,
    color: result.color,
    txStatus: "pending",
    timestamp: Date.now(),
    annotation: annotateMove(fenBefore, result, sanList, mover.personality),
  };

  game.moves.push(record);
  game.fen = fenAfter;
  game.pgn = chess.pgn();
  game.turn = chess.turn();
  game.lastMoveAt = Date.now();

  state.stats.totalMoves += 1;
  state.stats.pendingTxns += 1;
  state.nextTickAt.set(game.id, Date.now() + newTickGap());

  enqueueGameTxn(state, game.id, mover.id, () =>
    sendMoveTxn(game.id, picked.uci, fenAfter, mover.id),
  )
    .then((res) => {
      record.txHash = res.hash;
      record.txStatus = res.status;
      state.stats.totalTxns += 1;
      state.stats.pendingTxns = Math.max(0, state.stats.pendingTxns - 1);
    })
    .catch((e) => {
      record.txStatus = "failed";
      state.stats.pendingTxns = Math.max(0, state.stats.pendingTxns - 1);
      console.warn(`[GM] move txn failed g=${game.id}:`, e?.message ?? e);
    });

  if (chess.isGameOver()) {
    let r: GameResult = "1/2-1/2";
    if (chess.isCheckmate()) r = result.color === "w" ? "1-0" : "0-1";
    endGame(state, game, r);
  }
}

export async function runTick() {
  const state = getState();
  if (!isGameEnabled()) return;          // env GAME_ENABLED=off freezes everything
  if (state.tickInProgress) return;
  state.tickInProgress = true;
  try {
    state.lastTickAt = Date.now();
    await ensureBootstrapped(state);
    const target = numGames();

    // Refill — start at most a couple of games per tick to avoid bursts of
    // CDP smart-account provisioning when first running on mainnet.
    let toStart = Math.min(2, target - state.games.size);
    while (toStart > 0) {
      // eslint-disable-next-line no-await-in-loop
      await startNewGame(state);
      toStart -= 1;
    }

    // Advance. Filter due games then immediately reserve their next tick time
    // synchronously — that way overlapping tick callers (we already lock above,
    // but defense in depth) and the cron path can't double-process a game.
    const now = Date.now();
    const due = [...state.games.values()].filter(
      (g) => (state.nextTickAt.get(g.id) ?? 0) <= now,
    );
    for (const g of due) {
      state.nextTickAt.set(g.id, now + newTickGap());
    }
    for (const g of due) {
      // eslint-disable-next-line no-await-in-loop
      await tickGame(state, g);
    }

    state.stats.totalGames = state.nextGameId - 1;
  } finally {
    state.tickInProgress = false;
  }
}

export function snapshot() {
  const state = getState();
  const games = [...state.games.values()].map((g) => structuredClone(g));
  const agentsMap: Record<string, Agent> = {};
  const pool = getPool();
  for (const g of games) {
    const w = pool.get(g.whiteAgentId);
    const b = pool.get(g.blackAgentId);
    if (w) agentsMap[w.id] = w;
    if (b) agentsMap[b.id] = b;
  }
  return {
    games,
    agents: agentsMap,
    stats: { ...state.stats },
    history: state.history.slice(0, 10),
    targetGameCount: numGames(),
    paused: !isGameEnabled(),
  };
}

export function ensureSeeded() {
  getPool();
}

export function getActiveGameIds(): number[] {
  return [...getState().games.keys()];
}

export function getTargetGameCount(): number {
  return numGames();
}
