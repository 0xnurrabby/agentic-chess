import { createPublicClient, http, type PublicClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { AGENTIC_CHESS_ABI } from "./contractABI";

function chain() {
  return (process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia") === "base"
    ? base
    : baseSepolia;
}

let clientSingleton: PublicClient | null = null;

function getClient(): PublicClient {
  if (clientSingleton) return clientSingleton;
  clientSingleton = createPublicClient({
    chain: chain(),
    transport: http(),
  }) as PublicClient;
  return clientSingleton;
}

function contractAddress(): `0x${string}` | null {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr as `0x${string}`;
}

/**
 * Read totalGames from the contract. Returns null if no contract is configured
 * or the RPC call fails — caller should fall back to a local default.
 */
export async function getOnchainTotalGames(): Promise<bigint | null> {
  const addr = contractAddress();
  if (!addr) return null;
  try {
    const [games_] = (await getClient().readContract({
      address: addr,
      abi: AGENTIC_CHESS_ABI,
      functionName: "getStats",
    })) as [bigint, bigint];
    return games_;
  } catch (err) {
    console.warn("[readChain] getStats failed:", (err as Error)?.message ?? err);
    return null;
  }
}

/**
 * Read both totalGames and totalMoves from the contract. These are the
 * authoritative numbers shown in the platform stats header — local counters
 * are per-instance and reset on cold start.
 *
 * Cached for `STATS_TTL_MS` so repeated SSE ticks don't hammer the RPC.
 */
const STATS_TTL_MS = 12_000;
let statsCache:
  | { at: number; totalGames: number; totalMoves: number }
  | null = null;

export async function getOnchainStats(): Promise<{
  totalGames: number;
  totalMoves: number;
} | null> {
  const addr = contractAddress();
  if (!addr) return null;
  const now = Date.now();
  if (statsCache && now - statsCache.at < STATS_TTL_MS) {
    return { totalGames: statsCache.totalGames, totalMoves: statsCache.totalMoves };
  }
  try {
    const [games_, moves_] = (await getClient().readContract({
      address: addr,
      abi: AGENTIC_CHESS_ABI,
      functionName: "getStats",
    })) as [bigint, bigint];
    statsCache = {
      at: now,
      totalGames: Number(games_),
      totalMoves: Number(moves_),
    };
    return { totalGames: statsCache.totalGames, totalMoves: statsCache.totalMoves };
  } catch (err) {
    console.warn("[readChain] getStats failed:", (err as Error)?.message ?? err);
    return statsCache
      ? { totalGames: statsCache.totalGames, totalMoves: statsCache.totalMoves }
      : null;
  }
}

/**
 * Read the full game record (currentFen, moveCount, active) for a gameId from
 * the contract. Returns null if no contract is configured or the RPC call
 * fails. Used to resync local state when chain falls behind (e.g. when a
 * playMove UserOp failed at the bundler).
 */
export async function getOnchainGame(gameId: number): Promise<{
  currentFen: string;
  moveCount: bigint;
  active: boolean;
  whiteAgent: `0x${string}`;
  blackAgent: `0x${string}`;
} | null> {
  const addr = contractAddress();
  if (!addr) return null;
  try {
    const game = (await getClient().readContract({
      address: addr,
      abi: AGENTIC_CHESS_ABI,
      functionName: "getGame",
      args: [BigInt(gameId)],
    })) as {
      id: bigint;
      whiteAgent: `0x${string}`;
      blackAgent: `0x${string}`;
      currentFen: string;
      moveCount: bigint;
      active: boolean;
      result: string;
    };
    return {
      currentFen: game.currentFen,
      moveCount: game.moveCount,
      active: game.active,
      whiteAgent: game.whiteAgent,
      blackAgent: game.blackAgent,
    };
  } catch (err) {
    console.warn(
      `[readChain] getGame(${gameId}) failed:`,
      (err as Error)?.message ?? err,
    );
    return null;
  }
}

/**
 * Read the full UCI move list for a game from the contract, plus the tx
 * hashes for each move from MovePlayed event logs. Used to reconstruct a
 * complete move log when a cold-started lambda rehydrates a game it didn't
 * originate (the per-move metadata isn't in Redis).
 *
 * Returns moves in order with their hash where available (events may lag the
 * view read by a block, so some recent hashes can be missing — those render
 * as a non-link "onchain" badge).
 */
export async function getOnchainGameMoves(gameId: number): Promise<
  | { uci: string; txHash?: `0x${string}` }[]
  | null
> {
  const addr = contractAddress();
  if (!addr) return null;
  try {
    const client = getClient();
    const ucis = (await client.readContract({
      address: addr,
      abi: AGENTIC_CHESS_ABI,
      functionName: "getGameMoves",
      args: [BigInt(gameId)],
    })) as string[];
    if (!ucis || ucis.length === 0) return [];

    // Map move number → tx hash from MovePlayed events.
    const hashByMoveNo = new Map<number, `0x${string}`>();
    try {
      const logs = await client.getLogs({
        address: addr,
        event: {
          type: "event",
          name: "MovePlayed",
          inputs: [
            { name: "gameId", type: "uint256", indexed: true },
            { name: "agentAddress", type: "address", indexed: true },
            { name: "move", type: "string", indexed: false },
            { name: "fen", type: "string", indexed: false },
            { name: "moveNumber", type: "uint256", indexed: false },
            { name: "timestamp", type: "uint256", indexed: false },
          ],
        },
        args: { gameId: BigInt(gameId) },
        fromBlock: "earliest",
        toBlock: "latest",
      });
      for (const log of logs) {
        const mn = Number((log as { args: { moveNumber?: bigint } }).args.moveNumber ?? 0);
        const tx = (log as { transactionHash?: `0x${string}` }).transactionHash;
        if (mn > 0 && tx) hashByMoveNo.set(mn, tx);
      }
    } catch (err) {
      // Event lookups can be range-limited on some RPCs; degrade gracefully.
      console.warn(
        `[readChain] getLogs(MovePlayed ${gameId}) failed:`,
        (err as Error)?.message ?? err,
      );
    }

    return ucis.map((uci, i) => ({
      uci,
      txHash: hashByMoveNo.get(i + 1),
    }));
  } catch (err) {
    console.warn(
      `[readChain] getGameMoves(${gameId}) failed:`,
      (err as Error)?.message ?? err,
    );
    return null;
  }
}

/**
 * Check whether a given gameId slot is already claimed on chain.
 * Returns false on RPC failure so caller proceeds optimistically (chain will
 * reject with "exists" if it's actually taken).
 */
export async function isOnchainGameSlotTaken(gameId: number): Promise<boolean> {
  const addr = contractAddress();
  if (!addr) return false;
  try {
    const game = (await getClient().readContract({
      address: addr,
      abi: AGENTIC_CHESS_ABI,
      functionName: "getGame",
      args: [BigInt(gameId)],
    })) as { id: bigint; whiteAgent: `0x${string}` };
    return (
      game.id !== 0n ||
      game.whiteAgent !== "0x0000000000000000000000000000000000000000"
    );
  } catch (err) {
    console.warn(
      `[readChain] getGame(${gameId}) failed:`,
      (err as Error)?.message ?? err,
    );
    return false;
  }
}
