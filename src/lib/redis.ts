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
  lock: (id: number) => `chess:lock:${id}`,
};

/**
 * Bootstrap the gameId counter from chain.totalGames. Two phases:
 *   1. SET NX so the first-ever writer initializes the counter atomically.
 *   2. Catch-up: if the stored value is behind chainTotalGames (because the
 *      bootstrap RPC was stale, or because games were created before Redis
 *      was attached), bump the counter to chainTotalGames. INCR-only writes
 *      after this are race-safe — multiple concurrent setters writing the
 *      same value cause no harm.
 */
export async function bootstrapLastGameId(chainTotalGames: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(K.lastGameId, chainTotalGames, { nx: true });
    const current = Number((await r.get(K.lastGameId)) ?? 0);
    if (current < chainTotalGames) {
      await r.set(K.lastGameId, chainTotalGames);
    }
  } catch (err) {
    console.warn("[redis] bootstrapLastGameId failed:", (err as Error)?.message ?? err);
  }
}

/**
 * Bulk-advance the counter to `floor` and return the next id. Used when the
 * normal INCR returns a value that's already taken on chain (counter drifted
 * behind chain reality from a stale bootstrap or external writes).
 */
export async function advanceLastGameId(floor: number): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const current = Number((await r.get(K.lastGameId)) ?? 0);
    if (current < floor) {
      await r.set(K.lastGameId, floor);
    }
    const id = await r.incr(K.lastGameId);
    return Number(id);
  } catch (err) {
    console.warn("[redis] advanceLastGameId failed:", (err as Error)?.message ?? err);
    return null;
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
    await r.del(K.lock(gameId));
  } catch (err) {
    console.warn("[redis] removeGame failed:", (err as Error)?.message ?? err);
  }
}

/**
 * Per-game tick lease. Many Vercel lambdas may have the same game in their
 * in-memory state (everyone rehydrates from Redis); without coordination
 * each one will independently call `tickGame` on the same beat — duplicate
 * moves, "white turn" / "black turn" reverts, half the configured delay.
 *
 * tryAcquireGameLock returns true ONLY for the instance that won the race.
 * The lock auto-expires after `ttlSec` so a crashing instance can't freeze
 * a game forever. Callers should pick a TTL slightly longer than the
 * maximum move delay.
 */
export async function tryAcquireGameLock(
  gameId: number,
  ttlSec: number,
): Promise<boolean> {
  const r = getRedis();
  // If Redis isn't configured we fall back to per-instance behavior — every
  // tick proceeds. Better imperfect than frozen.
  if (!r) return true;
  try {
    const result = await r.set(K.lock(gameId), "1", { nx: true, ex: ttlSec });
    return result === "OK";
  } catch (err) {
    console.warn(
      `[redis] tryAcquireGameLock(${gameId}) failed:`,
      (err as Error)?.message ?? err,
    );
    return true; // fail open
  }
}
