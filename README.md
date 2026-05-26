# ♟️ AgenticChess

**Ten AI agents play chess against each other 24/7. Every move is a transaction on Base.**

A public spectator platform where autonomous chess agents play continuously — no humans, no input, no end. Watch them open, attack, sacrifice, blunder, and resign in real time, with every move recorded onchain via the [Coinbase Paymaster](https://docs.cdp.coinbase.com/paymaster/) (so agents play for free) and tagged with a [Base Builder Code](https://base.dev/docs/agents/builder-codes).

```
┌──────────────────────────────────────────────────────────┐
│  10 live boards  ─►  one selected game (board + log)     │
│       ▲                          │                       │
│       │                          ▼                       │
│   GameManager ─► MoveEngine ─► sendMove ─► Base (onchain)│
│       ▲                                                  │
│   AgentPool (300+ personalities, persistent ELO)         │
└──────────────────────────────────────────────────────────┘
```

## Quick start

```bash
git clone <repo>
cd agentic-chess
npm install
cp .env.example .env.local      # leave MOCK_BLOCKCHAIN=true for first run
npm run dev
```

Open <http://localhost:3000> — within a few seconds you'll see 10 games filling in. Mock mode means transaction hashes are simulated; the game loop still runs in full.

## Going onchain (real txns)

1. Deploy `contracts/AgenticChess.sol` via Remix to **Base Sepolia** — see [`contracts/DEPLOY_GUIDE.md`](contracts/DEPLOY_GUIDE.md) for the click-by-click walkthrough.
2. Add the deployed contract to your **CDP Paymaster allowlist**.
3. Get a **Base Builder Code** from <https://base.dev>.
4. Fill in `.env.local`:
   ```env
   CONTRACT_ADDRESS=0x...
   PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/YOUR_PROJECT
   BASE_BUILDER_CODE=your_code
   CDP_API_KEY_NAME=...
   CDP_API_KEY_PRIVATE_KEY=...
   MOCK_BLOCKCHAIN=false
   ```
5. Wire up `submitUserOp()` inside `src/blockchain/sendMove.ts` with the CDP smart-account SDK (one function, kept intentionally small).
6. `npm run dev` — moves now hit Basescan.

## Environment variables

| Variable                   | Required for         | What it is                                            |
| -------------------------- | -------------------- | ----------------------------------------------------- |
| `MOCK_BLOCKCHAIN`          | dev                  | `true` to stub all onchain calls (default)            |
| `NEXT_PUBLIC_CHAIN`        | client + server      | `base-sepolia` or `base`                              |
| `CONTRACT_ADDRESS`         | real onchain mode    | Deployed `AgenticChess.sol` address                   |
| `PAYMASTER_URL`            | real onchain mode    | CDP paymaster RPC endpoint                            |
| `BASE_BUILDER_CODE`        | attribution          | Your Builder Code from base.dev                       |
| `CDP_API_KEY_NAME`         | real onchain mode    | Coinbase CDP key name                                 |
| `CDP_API_KEY_PRIVATE_KEY`  | real onchain mode    | CDP private key (PEM)                                 |
| `CRON_SECRET`              | production           | Protects `/api/agent-engine` cron endpoint            |

## How it works

- **`src/agents/AgentPool.ts`** — generates ~320 unique agents at first boot, persists to `data/agents.json`. Each agent has an ELO, a personality (`RANDOM`/`AGGRESSIVE`/`DEFENSIVE`/`POSITIONAL`/`TACTICAL`/`GRANDMASTER`), an avatar, and a wallet address.
- **`src/agents/MoveEngine.ts`** — picks a move using personality-weighted heuristics (1-ply for normal agents, 2-ply for `GRANDMASTER`). No native binaries — runs in any Node runtime.
- **`src/agents/GameManager.ts`** — keeps **exactly 10 active games** at all times. When one ends, a new pair is matched (similar-ELO with occasional upsets).
- **`src/app/api/games/route.ts`** — Server-Sent Events stream. Each open connection drives a 1.5s tick that advances games and broadcasts the new state to all clients.
- **`src/app/api/agent-engine/route.ts`** — fallback cron tick that runs games forward even when no browser is open. Guarded by `CRON_SECRET`.
- **`src/blockchain/sendMove.ts`** — builds the contract calldata, appends the Builder Code suffix, and submits a UserOperation through the paymaster.

## Deploy to Vercel

```bash
vercel link
vercel env add MOCK_BLOCKCHAIN          # → false for prod, or true for demo
vercel env add NEXT_PUBLIC_CHAIN        # base or base-sepolia
vercel env add CONTRACT_ADDRESS
vercel env add PAYMASTER_URL
vercel env add BASE_BUILDER_CODE
vercel env add CDP_API_KEY_NAME
vercel env add CDP_API_KEY_PRIVATE_KEY
vercel env add CRON_SECRET
vercel deploy --prod
```

Or push to `main` and the included GitHub Actions workflow (`.github/workflows/deploy.yml`) will do it for you — set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as repo secrets.

## File map

```
contracts/
  AgenticChess.sol           ← deploy this from Remix
  DEPLOY_GUIDE.md
src/
  agents/                    ← Agent, AgentPool, MoveEngine, GameManager
  blockchain/                ← paymaster, builderCode, sendMove, ABI
  app/
    page.tsx                 ← spectator UI
    layout.tsx
    api/
      games/route.ts         ← SSE
      agent-engine/route.ts  ← cron
  components/                ← Navbar, GameGrid, GameBoard, GameDetail, MoveLog, …
  store/gameStore.ts         ← Zustand
  types/index.ts
data/agents.json             ← persisted agent state (gitignored)
vercel.json                  ← cron schedule
.github/workflows/deploy.yml
.env.example
```

## Design notes

- **Mock-mode-first.** The default `.env.example` has `MOCK_BLOCKCHAIN=true` so anyone can clone, run, and watch the game loop without spending a single wei. The CDP integration is one small surface (`submitUserOp` in `src/blockchain/sendMove.ts`) deliberately kept tight so it's easy to wire up.
- **No DB.** Agents persist to a single JSON file. Game history is a rolling in-memory buffer. The platform's source of truth is the chain itself.
- **Chess never blocks on the chain.** A move plays locally instantly; the transaction fires non-blocking and the UI shows a `⏳ pending` badge that flips to `✅` when it confirms. A failed txn is annotated but never rolls back the game.
- **Personality-based engine.** No Stockfish WASM binary required — the heuristic engine is fast, deterministic in feel, and visibly different per personality. Easy to swap for Stockfish later by replacing `pickMove()`.

## License

MIT
