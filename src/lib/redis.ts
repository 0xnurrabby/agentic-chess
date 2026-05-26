import { Redis } from "@upstash/redis";

/**
 * Shared cross-instance state via Upstash Redis.
 *
 * Why: on Vercel Hobby every tab/refresh can hit a different lambda. Each
 * lambda has its own in-memory game state, so viewers see different boards.
 * The chain is shared but rebuilding live game state from it on every cold
 * start is expensive and incomplete. Redis sits between: cheap atomic
 * counters + a small "active games" index, so every instance can converge
 * on the same set of games to display.
 *
 * Redis is OPTIONAL. If UPSTASH_REDIS_REST_URL / TOKEN are not set, every
 * helper here returns null/noops and the platform falls back to the previous
 * per-instance behavior. That way dev and mock-mode stay zero-dependency.
 *
 * Free-tier-aware: writes are kept minimal (only on game start / end / agent
 * assignment), per-move state stays in process memory.
 *
 * Key layout (all prefixed `chess:`):
 *   chess:lastGameId          counter — last allocated gameId (INCR for next)
 *   chess:active              set of currently-active gameIds
 *   chess:assign:{gameId}     hash {white: agentId, black: agentId}
 */

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

export function isRedisEnabled(): boolean {
  return getRedis() !== null;
}

const K = {
  lastGameId: "chess:lastGameId",
  active: "chess:active",
  assign: (id: number) => `chess:assign:${id}`,
};

/**
 * One-time bootstrap of the gameId counter from chain.totalGames. SET NX so
 * concurrent instances don't fight over the value — only the first writer
 * sticks.
 */
export async function bootstrapLastGameId(chainTotalGames: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    // Store the LAST USED gameId. INCR returns NEXT id.
    await r.set(K.lastGameId, chainTotalGames, { nx: true });
  } catch (err) {
    console.warn("[redis] bootstrapLastGameId failed:", (err as Error)?.message ?? err);
  }
}

/** Atomic gameId allocator. Returns null if Redis disabled. */
export async function allocateGameId(): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const id = await r.incr(K.lastGameId);
    return Number(id);
  } catch (err) {
    console.warn("[redis] allocateGameId failed:", (err as Error)?.message ?? err);
    return null;
  }
}

/** Record an agent pairing so any instance can pick up the game later. */
export async function saveAssignment(
  gameId: number,
  whiteAgentId: string,
  blackAgentId: string,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.hset(K.assign(gameId), { white: whiteAgentId, black: blackAgentId });
    await r.sadd(K.active, gameId);
  } catch (err) {
    console.warn("[redis] saveAssignment failed:", (err as Error)?.message ?? err);
  }
}

export async function getAssignment(
  gameId: number,
): Promise<{ white: string; black: string } | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const a = (await r.hgetall(K.assign(gameId))) as
      | { white?: string; black?: string }
      | null;
    if (!a || !a.white || !a.black) return null;
    return { white: a.white, black: a.black };
  } catch (err) {
    console.warn("[redis] getAssignment failed:", (err as Error)?.message ?? err);
    return null;
  }
}

/** List currently-active gameIds across all instances. */
export async function listActiveGameIds(): Promise<number[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const raw = (await r.smembers(K.active)) as Array<string | number>;
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  } catch (err) {
    console.warn("[redis] listActiveGameIds failed:", (err as Error)?.message ?? err);
    return [];
  }
}

/** Remove a game from the active index. Called by the instance that ends it. */
export async function removeGame(gameId: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.srem(K.active, gameId);
    await r.del(K.assign(gameId));
  } catch (err) {
    console.warn("[redis] removeGame failed:", (err as Error)?.message ?? err);
  }
}
