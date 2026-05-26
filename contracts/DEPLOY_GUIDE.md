# AgenticChess Contract — Deployment Guide

This contract is **standalone** — no Hardhat or Foundry needed. Deploy it directly from Remix IDE in your browser.

## 1. Deploy via Remix IDE

1. Open <https://remix.ethereum.org>.
2. Create a new file `AgenticChess.sol` in the `contracts/` folder.
3. Paste the contents of `contracts/AgenticChess.sol` from this repo.
4. In **Solidity Compiler** tab:
   - Compiler version: `0.8.20+` (any 0.8.20 or higher works).
   - Optimization: enabled, runs: `200`.
   - Click **Compile AgenticChess.sol**.
5. In **Deploy & Run Transactions** tab:
   - **Environment**: choose **Injected Provider — MetaMask**.
   - Make sure MetaMask is on **Base Sepolia** (chainId `84532`) — or **Base Mainnet** (`8453`) for production.
   - **Contract**: select `AgenticChess`.
   - Click **Deploy** and confirm the transaction in MetaMask.
6. Once mined, **copy the deployed contract address** from the Deployed Contracts panel.

## 2. Add to your `.env.local`

```env
CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_CHAIN=base-sepolia
```

## 3. Add the contract to your CDP Paymaster allowlist

Coinbase Paymaster sponsors gas only for contracts on its allowlist.

1. Go to <https://portal.cdp.coinbase.com>.
2. Open **Bundler & Paymaster** product.
3. Select your project, switch to **Base Sepolia** (or Base mainnet).
4. Open **Configuration → Allowlist**.
5. Click **Add contract**.
6. Paste the deployed contract address.
7. Allowed functions — add these signatures:
   - `startGame(uint256,address,address)`
   - `playMove(uint256,string,string)`
   - `endGame(uint256,address,string)`
8. Save.
9. From **Configuration → API**, copy your **Paymaster RPC URL**. Paste into `.env.local`:

```env
PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/YOUR_PROJECT_ID
```

## 4. Get a Base Builder Code

Every transaction sent by AgenticChess carries your **Builder Code** as a calldata suffix
so Base can attribute platform activity to you.

1. Go to <https://base.dev>.
2. Sign in with your wallet.
3. **Settings → Builder Code** → copy your code (a short string).
4. Paste into `.env.local`:

```env
BASE_BUILDER_CODE=your_builder_code_here
```

The builder code is appended via the `dataSuffix` helper in `src/blockchain/builderCode.ts`.

## 5. Verify everything works

Start the app in mock mode first (no real txns):

```bash
MOCK_BLOCKCHAIN=true npm run dev
```

Then flip the switch:

```bash
MOCK_BLOCKCHAIN=false npm run dev
```

You should see `✅ confirmed` badges with real tx hashes on Basescan after each move.

## Contract addresses on Base networks

| Network        | Chain ID | Explorer                              |
| -------------- | -------- | ------------------------------------- |
| Base Sepolia   | 84532    | https://sepolia.basescan.org          |
| Base Mainnet   | 8453     | https://basescan.org                  |

## Notes

- The contract has no admin / owner. Anyone with an agent address can call its functions.
- The agent's address is the wallet derived from their CDP wallet (managed in `src/agents/Agent.ts`).
- For production, fund the Paymaster — gas sponsorship will silently fail if balance is depleted.
