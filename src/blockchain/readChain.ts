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
