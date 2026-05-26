import { encodeFunctionData, keccak256, toHex } from "viem";
import { AGENTIC_CHESS_ABI } from "./contractABI";
import { getBuilderDataSuffix } from "./builderCode";
import { cdpEnvOk, getCdpClient } from "./cdpClient";
import { getAgentWallet } from "./walletPool";
import type { TxStatus } from "@/types";

export interface SendResult {
  hash: `0x${string}`;
  status: TxStatus;
}

const NETWORK = ((): "base" | "base-sepolia" => {
  const c = process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia";
  return c === "base" ? "base" : "base-sepolia";
})();

const PAYMASTER_URL = process.env.PAYMASTER_URL || undefined;

function mockHash(seed: string): `0x${string}` {
  return keccak256(toHex(seed + Date.now() + Math.random())) as `0x${string}`;
}

function contractAddress(): `0x${string}` | null {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr as `0x${string}`;
}

export function isMockMode(): boolean {
  // MOCK_BLOCKCHAIN: 'auto' (default) → real if CDP env present, else mock.
  // 'true' → force mock. 'false' → force real.
  const v = (process.env.MOCK_BLOCKCHAIN ?? "auto").toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  // auto
  return !cdpEnvOk();
}

// ---- Error tracking surface ----
const lastError: { message: string; at: number } = { message: "", at: 0 };
export function getLastChainError() {
  return lastError;
}
function recordError(msg: string) {
  lastError.message = msg;
  lastError.at = Date.now();
}

function describeError(e: unknown): string {
  if (!e) return "unknown";
  const any = e as Record<string, unknown>;
  const parts: string[] = [];
  if (any.httpCode != null) parts.push(`HTTP ${any.httpCode}`);
  if (typeof any.apiCode === "string" && any.apiCode) parts.push(any.apiCode);
  if (typeof any.apiMessage === "string" && any.apiMessage) parts.push(any.apiMessage);
  if (typeof any.code === "string" && any.code) parts.push(any.code);
  const response = any.response as Record<string, unknown> | undefined;
  if (response) {
    if (response.status != null) parts.push(`status=${response.status}`);
    const data = response.data as unknown;
    if (data) {
      const flat = typeof data === "string" ? data : JSON.stringify(data).slice(0, 200);
      parts.push(`body=${flat}`);
    }
  }
  if (parts.length === 0) {
    const msg = (e as Error)?.message;
    parts.push(msg || String(e));
    try {
      console.error("[CDP] error:", e);
    } catch {
      /* ignore */
    }
  }
  return parts.join(" · ").slice(0, 380);
}

// ---- Real CDP UserOperation submission ----

interface SendOpts {
  agentId: string;            // which agent's smart account is sending
  abi: typeof AGENTIC_CHESS_ABI;
  functionName: "startGame" | "playMove" | "endGame";
  args: readonly unknown[];
  label: string;
}

async function sendViaSmartAccount(opts: SendOpts): Promise<SendResult> {
  const addr = contractAddress();
  if (!addr) throw new Error("CONTRACT_ADDRESS not set");

  const cdp = getCdpClient();
  const smartAccount = await getAgentWallet(opts.agentId);

  const dataSuffix = getBuilderDataSuffix();
  const data = encodeFunctionData({
    abi: opts.abi,
    functionName: opts.functionName,
    args: opts.args as never,
  });

  const userOp = await cdp.evm.sendUserOperation({
    smartAccount,
    network: NETWORK,
    calls: [{ to: addr, value: 0n, data }],
    // CDP SDK natively supports ERC-8021 attribution via dataSuffix.
    ...(dataSuffix !== "0x" ? { dataSuffix } : {}),
    ...(PAYMASTER_URL ? { paymasterUrl: PAYMASTER_URL } : {}),
  });

  const confirmed = await cdp.evm.waitForUserOperation({
    smartAccountAddress: smartAccount.address,
    userOpHash: userOp.userOpHash,
  });

  if (confirmed.status === "complete" && "transactionHash" in confirmed) {
    // Small settling delay BEFORE returning. waitForUserOperation reports
    // "complete" when the bundler has the receipt, but the CDP bundler's
    // simulator pulls chain state from its own RPC source and may be a
    // beat behind. The next op for the same game often comes from the
    // OTHER smart account (white→black or black→white), whose UserOp gets
    // simulated against that stale view — leading to a "white turn" /
    // "black turn" revert even though our local + per-game queue have
    // already serialized correctly. A short delay here lets the bundler
    // catch up before the next cross-account UserOp fires.
    await new Promise((r) => setTimeout(r, 800));
    return { hash: confirmed.transactionHash as `0x${string}`, status: "confirmed" };
  }
  return { hash: mockHash(opts.label), status: "failed" };
}

// ---- Public API ----

export async function sendMoveTxn(
  gameId: number,
  uci: string,
  fenAfter: string,
  signerAgentId: string,
): Promise<SendResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
    return { hash: mockHash(`move:${gameId}:${uci}:${signerAgentId}`), status: "confirmed" };
  }
  try {
    return await sendViaSmartAccount({
      agentId: signerAgentId,
      abi: AGENTIC_CHESS_ABI,
      functionName: "playMove",
      args: [BigInt(gameId), uci, fenAfter],
      label: `playMove(${gameId})`,
    });
  } catch (e) {
    recordError(`playMove(${gameId}) — ${describeError(e)}`);
    return { hash: mockHash(`fail:${gameId}:${uci}`), status: "failed" };
  }
}

export async function sendStartGameTxn(
  gameId: number,
  white: `0x${string}`,
  black: `0x${string}`,
  signerAgentId: string,
): Promise<SendResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
    return { hash: mockHash(`start:${gameId}:${white}:${black}`), status: "confirmed" };
  }
  try {
    return await sendViaSmartAccount({
      agentId: signerAgentId,
      abi: AGENTIC_CHESS_ABI,
      functionName: "startGame",
      args: [BigInt(gameId), white, black],
      label: `startGame(${gameId})`,
    });
  } catch (e) {
    recordError(`startGame(${gameId}) — ${describeError(e)}`);
    return { hash: mockHash(`fail:start:${gameId}`), status: "failed" };
  }
}

export async function sendEndGameTxn(
  gameId: number,
  winner: `0x${string}`,
  result: string,
  signerAgentId: string,
): Promise<SendResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
    return { hash: mockHash(`end:${gameId}:${winner}:${result}`), status: "confirmed" };
  }
  try {
    return await sendViaSmartAccount({
      agentId: signerAgentId,
      abi: AGENTIC_CHESS_ABI,
      functionName: "endGame",
      args: [BigInt(gameId), winner, result],
      label: `endGame(${gameId})`,
    });
  } catch (e) {
    recordError(`endGame(${gameId}) — ${describeError(e)}`);
    return { hash: mockHash(`fail:end:${gameId}`), status: "failed" };
  }
}
