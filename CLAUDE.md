# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on http://localhost:3000.
- `npm run build` — production build.
- `npm start` — run the production build.
- `npm run lint` — ESLint (`eslint-config-next`).
- `npm run typecheck` — `tsc --noEmit`. No test runner is configured.

There is no test framework. When you need to verify changes, run `npm run typecheck` and exercise the dev server in a browser.

## Runtime modes

`isMockMode()` in `src/blockchain/sendMove.ts` decides whether onchain calls are real or stubbed. The flag is read from `MOCK_BLOCKCHAIN`:

- `auto` (default) — real if `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, and `CDP_WALLET_SECRET` are all set; otherwise mock.
- `true` / `1` — force mock (instant fake tx hashes, ~200–800ms latency).
- `false` / `0` — force real, even if env is incomplete (will fail).

The actual env-var names checked by code (`cdpEnvOk` in `src/blockchain/cdpClient.ts`) are `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET`. The README mentions older names like `CDP_API_KEY_NAME` / `CDP_API_KEY_PRIVATE_KEY` — these are not what the code reads. Trust `.env.example` and `cdpClient.ts` over the README.

`NUM_GAMES` (env) clamps the active-game target to 1–20 (default 10).

## Architecture

### Game loop is a process-global singleton

`src/agents/GameManager.ts` stores all live state on `global.__agenticChess` so it survives Next.js dev hot-reloads and is shared across requests within a single Node process. **It is not horizontally scalable** — if Vercel spins up multiple lambdas, each gets its own independent set of games. The design assumes a single long-lived Node process driven by an open SSE connection.

State held there: active games (`Map<gameId, GameState>`), recent history (rolling 50), platform stats, per-game next-tick timestamps, and `txQueue` (see below).

### Two tick drivers

1. **SSE (`src/app/api/games/route.ts`)** — every open browser holds a stream. Each stream runs its own `setInterval(runTick, 1500ms)` and pushes a snapshot per tick. With multiple viewers, ticks run more often than 1.5s; `tickGame` guards against this via per-game `nextTickAt` (randomized 1.8–4.5s gap).
2. **Cron (`src/app/api/agent-engine/route.ts`)** — Vercel cron hits this every minute (see `vercel.json`) so games keep advancing with no viewers. Protected by `CRON_SECRET`.

Both call `runTick()`; both mutate the same global state.

### Per-game serial tx queue (important)

`AgenticChess.sol` enforces strict turn order by checking `msg.sender` against `moveCount` parity. If two `playMove` UserOperations for the same game land at the chain out of order, the second reverts.

`enqueueGameTxn(state, gameId, task)` chains every chain submission for a given gameId onto a per-game promise queue. **Any new code that calls into the chain for an existing game must go through this queue.** Each move is recorded locally instantly; the chain submission is fire-and-forget against the queue, and the move record's `txStatus` flips from `pending` → `confirmed`/`failed` when it settles. A failed txn is never rolled back in the game state.

### CDP dual-wallet model

CDP v2 only allows one smart account per owner EOA. For each agent, `getAgentSmartAccount` provisions **two** wallets: an EOA named `{agent-id}-eoa` (signs UserOperations, holds no funds) and a smart account named `{agent-id}` (the `msg.sender` seen by the contract, gets gas sponsored by the managed paymaster). Names are sanitized to CDP's rules (alphanumeric + hyphens, 2–36 chars).

`ensureRealAddress` in `GameManager.ts` rewrites the agent's `walletAddress` to the real smart-account address before the first `startGame` txn. In mock mode the random address generated at seed time stays.

### Agent persistence

`src/agents/AgentPool.ts` seeds 320 agents on first boot into `data/agents.json` (gitignored). ELO/record updates are written in-memory via `saveAgent` and flushed to disk by `flush()` after each game ends. On Vercel the filesystem is ephemeral; the JSON file resets between deployments and may reset between invocations. This is acknowledged ("best-effort") and is not a bug.

### Move engine

`src/agents/MoveEngine.ts` is a hand-rolled heuristic engine — no Stockfish, no WASM. 1-ply for most personalities, 2-ply for `GRANDMASTER`. `pickMove(fen, personality)` is the swap point if you want to drop in a real engine later.

### Frontend

App Router (Next 14). `src/app/page.tsx` is the entire spectator UI; live state arrives via SSE and is held in a Zustand store at `src/store/gameStore.ts`. The board UI uses `react-chessboard`; `chess.js` is used both server-side (move generation, validation, PGN, terminal detection) and client-side.

## Conventions

- Path alias: `@/*` → `src/*` (see `tsconfig.json`).
- Errors from chain submissions are recorded in a single `lastError` slot (`getLastChainError`) and surfaced to the UI via `ChainErrorBanner`. Don't throw out of `sendMoveTxn` / `sendStartGameTxn` / `sendEndGameTxn` — return a `failed` `SendResult` instead so the game loop continues.
- When changing the contract ABI or `AgenticChess.sol`, update `src/blockchain/contractABI.ts` and re-deploy via `contracts/DEPLOY_GUIDE.md`; there is no codegen.
