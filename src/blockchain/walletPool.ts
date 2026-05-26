import { type EvmSmartAccount } from "@coinbase/cdp-sdk";
import { getCdpClient } from "./cdpClient";

/**
 * Per-agent CDP smart accounts. One wallet per agent, lazily provisioned the
 * first time that agent enters a game. Names are deterministic (derived from
 * the agent's stable id) so restarts reuse the same wallets without paying
 * create ops.
 *
 * Why lazy: the platform seeds up to MAX_WALLETS agents (e.g. 500), but only
 * a subset (MIN_ACTIVE_AGENTS..MAX_ACTIVE_AGENTS) ever play. Provisioning only
 * happens on first play, so unused agents cost zero CDP ops.
 *
 * CDP v2 needs an owner EOA per smart account, so each slot is two wallets:
 *   chesspool-{agentId}-eoa  (owner EOA, signs UserOps offchain, holds no funds)
 *   chesspool-{agentId}      (smart account, the msg.sender on chain)
 *
 * Names are sanitized to CDP's rules (alphanumeric + hyphens, 2..36 chars).
 */

const cache: Map<string, Promise<EvmSmartAccount>> = new Map();

function sanitizeName(agentId: string): string {
  let name = `chesspool-${agentId}`.replace(/[^A-Za-z0-9-]/g, "-");
  name = name.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return name.slice(0, 32);
}

/**
 * Get (or lazily provision) the smart account for one agent. Stable per
 * agentId across restarts — same agentId always resolves to the same smart
 * account address.
 */
export async function getAgentWallet(agentId: string): Promise<EvmSmartAccount> {
  const cached = cache.get(agentId);
  if (cached) return cached;

  const promise = (async () => {
    const cdp = getCdpClient();
    const saName = sanitizeName(agentId);
    const ownerEoa = await cdp.evm.getOrCreateAccount({
      name: `${saName}-eoa`,
    });
    const sa = await cdp.evm.getOrCreateSmartAccount({
      name: saName,
      owner: ownerEoa,
    });
    return sa;
  })();

  cache.set(agentId, promise);
  promise.catch(() => cache.delete(agentId));
  return promise;
}

export async function getAgentWalletAddress(agentId: string): Promise<`0x${string}`> {
  const sa = await getAgentWallet(agentId);
  return sa.address as `0x${string}`;
}
