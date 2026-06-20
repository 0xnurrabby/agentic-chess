<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,4,12&height=180&section=header&text=Agentic+Chess&fontSize=50&fontColor=000000&fontAlignY=38&desc=Autonomous+chess+agents+playing+live+games+with+Base+transaction+attribution&descAlignY=58&descSize=14&animation=fadeIn" width="100%"/>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-DDD6FE?style=for-the-badge&labelColor=1a1a1a&logoColor=1a1a1a)
![Game](https://img.shields.io/badge/Game-Chess+Agents-BAE6FD?style=for-the-badge&labelColor=1a1a1a&logoColor=1a1a1a)
![Chain](https://img.shields.io/badge/Chain-Base-FDE68A?style=for-the-badge&labelColor=1a1a1a&logoColor=1a1a1a)
![Storage](https://img.shields.io/badge/Storage-Upstash+Optional-BBF7D0?style=for-the-badge&labelColor=1a1a1a&logoColor=1a1a1a)

</div>

<div align="center">
<i>Ten autonomous chess boards run in public, with agent personalities, live move logs, and optional CDP-powered onchain submissions.</i>
</div>

---

## Features

| Feature | What it does |
| --- | --- |
| Live boards | Multiple games run at the same time with a selected board and move log. |
| Agent pool | Hundreds of persistent agents with names, ratings, personalities, and wallets. |
| Chess engine | Personality-weighted move choices powered by `chess.js` logic. |
| Base attribution | Builder code and CDP wallet settings are ready for real submissions. |
| Mock-first dev | Clone and run without spending funds or touching a real wallet secret. |

---

## Download and Run

```powershell
git clone https://github.com/0xnurrabby/agentic-chess.git
cd agentic-chess
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Leave `MOCK_BLOCKCHAIN=auto` or set it to `true` for your first run.

---

## Setup

For a local mock run, `.env.example` is enough.

For real onchain mode, fill these values in `.env.local`:

```env
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
CONTRACT_ADDRESS=0x...
BASE_BUILDER_CODE=bc_...
NEXT_PUBLIC_CHAIN=base
MOCK_BLOCKCHAIN=false
CRON_SECRET=long_random_string
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Useful checks:

```bash
npm run typecheck
npm run build
```

---

## Project Structure

```text
agentic-chess/
  contracts/           -> AgenticChess contract files
  src/agents/          -> agent pool, game manager, move engine
  src/blockchain/      -> CDP, paymaster, builder code, sendMove
  src/app/             -> Next.js app and API routes
  src/components/      -> board, game grid, leaderboard, badges
  src/store/           -> Zustand game store
  vercel.json          -> production cron config
```

---

## Notes

- Mock mode is the right first step on a new PC.
- Use Upstash Redis in production so state survives cold starts and multiple function instances.
- Treat CDP wallet secrets like private keys.

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,4,12&height=90&section=footer" width="100%"/>

<p align="center">
  <sub>MIT License unless noted otherwise. Built by <a href="https://github.com/0xnurrabby">0xnurrabby</a>.</sub>
</p>
