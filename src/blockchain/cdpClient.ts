import { CdpClient } from "@coinbase/cdp-sdk";

/**
 * Coinbase Developer Platform v2 — client singleton and env validation.
 *
 * Per-agent smart accounts are NOT created here. Instead a small fixed
 * `walletPool` of shared smart accounts is used, and personas lease one for
 * the duration of a game (see src/blockchain/walletPool.ts). That keeps the
 * total number of CDP wallet operations bounded regardless of how many
 * personas the game runs.
 */

let clientSingleton: CdpClient | null = null;

export function cdpEnvOk(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID &&
      process.env.CDP_API_KEY_SECRET &&
      process.env.CDP_WALLET_SECRET,
  );
}

export function cdpMissingEnvList(): string[] {
  const missing: string[] = [];
  if (!process.env.CDP_API_KEY_ID) missing.push("CDP_API_KEY_ID");
  if (!process.env.CDP_API_KEY_SECRET) missing.push("CDP_API_KEY_SECRET");
  if (!process.env.CDP_WALLET_SECRET) missing.push("CDP_WALLET_SECRET");
  return missing;
}

export function getCdpClient(): CdpClient {
  if (clientSingleton) return clientSingleton;
  const missing = cdpMissingEnvList();
  if (missing.length > 0) {
    throw new Error(`CDP env missing: ${missing.join(", ")}`);
  }
  clientSingleton = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
  });
  return clientSingleton;
}
