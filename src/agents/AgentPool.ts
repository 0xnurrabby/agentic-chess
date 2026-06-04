import fs from "node:fs";
import path from "node:path";
import { Agent } from "@/types";
import { createAgent } from "./Agent";
import { decryptString, encryptString } from "@/lib/crypto";
import { loadAgentStates, saveAgentState } from "@/lib/redis";

const DATA_DIR = path.join(process.cwd(), "data");
const POOL_FILE = path.join(DATA_DIR, "agents.json");

let pool: Map<string, Agent> | null = null;
let redisHydrationStarted = false;
let redisHydrationDone = false;

/**
 * Maximum total agents that can be seeded. One wallet per agent (1:1) is
 * provisioned lazily on first play, so an agent that never enters a game
 * costs zero CDP ops.
 */
function maxWallets(): number {
  const raw = process.env.MAX_WALLETS;
  const n = raw ? parseInt(raw, 10) : 500;
  if (!Number.isFinite(n) || n < 2) return 500;
  return Math.min(n, 5000);
}

/**
 * Range of agents in the active rotation pool. At first boot a single random
 * integer K is picked from [MIN_ACTIVE_AGENTS, MAX_ACTIVE_AGENTS]; agents 0..K-1
 * are eligible for matchmaking. K is bounded by maxWallets so the values are
 * self-consistent.
 */
function activeAgentRange(): [number, number] {
  const M = maxWallets();
  const minRaw = process.env.MIN_ACTIVE_AGENTS;
  const maxRaw = process.env.MAX_ACTIVE_AGENTS;
  const min = minRaw ? parseInt(minRaw, 10) : Math.min(300, M);
  const max = maxRaw ? parseInt(maxRaw, 10) : Math.min(400, M);
  const lo = Math.max(2, Math.min(min, M));
  const hi = Math.max(lo, Math.min(max, M));
  return [lo, hi];
}

export function activeCount(): number {
  const [min, max] = activeAgentRange();
  if (max === min) return min;
  const agents = [...getPool().values()];
  const minimumCovered = agents
    .slice(0, min)
    .every((a) => (a.lastPlayedAt ?? 0) > 0);
  return minimumCovered ? max : min;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Map<string, Agent> | null {
  try {
    if (!fs.existsSync(POOL_FILE)) return null;
    const raw = fs.readFileSync(POOL_FILE, "utf-8");
    const json = decryptString(raw);
    const arr: Agent[] = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    // Preserve insertion order — first N agents are "active" by index.
    arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return new Map(arr.map((a) => [a.id, a]));
  } catch (err) {
    console.warn("[AgentPool] load failed:", (err as Error)?.message ?? err);
    return null;
  }
}

function persist(map: Map<string, Agent>) {
  try {
    ensureDir();
    const json = JSON.stringify([...map.values()], null, 2);
    fs.writeFileSync(POOL_FILE, encryptString(json));
  } catch (err) {
    // best-effort — Vercel filesystem is ephemeral
    console.warn("[AgentPool] persist failed:", err);
  }
}

function seed(): Map<string, Agent> {
  const size = maxWallets();
  const m = new Map<string, Agent>();
  for (let i = 0; i < size; i++) {
    const a = createAgent(i);
    m.set(a.id, a);
  }
  return m;
}

/**
 * Grow the pool to match the configured size when MAX_WALLETS is raised after
 * the first run. Shrinks are intentionally NOT applied — keeping already-seeded
 * personas preserves their ELO history.
 */
function growIfNeeded(map: Map<string, Agent>) {
  const target = maxWallets();
  if (map.size >= target) return false;
  for (let i = map.size; i < target; i++) {
    const a = createAgent(i);
    if (!map.has(a.id)) map.set(a.id, a);
  }
  return true;
}

export function getPool(): Map<string, Agent> {
  if (pool) return pool;
  const loaded = load();
  pool = loaded ?? seed();
  const grew = growIfNeeded(pool);
  if (!loaded || grew) persist(pool);
  return pool;
}

export async function hydrateAgentsFromRedis(): Promise<void> {
  if (redisHydrationDone) return;
  if (redisHydrationStarted) {
    while (!redisHydrationDone) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 25));
    }
    return;
  }
  redisHydrationStarted = true;
  try {
    const p = getPool();
    const saved = await loadAgentStates();
    let changed = false;
    for (const agent of saved) {
      if (!p.has(agent.id)) continue;
      p.set(agent.id, agent);
      changed = true;
    }
    if (changed) persist(p);
  } finally {
    redisHydrationDone = true;
  }
}

export function saveAgent(a: Agent) {
  const p = getPool();
  p.set(a.id, a);
  saveAgentState(a).catch(() => {});
}

export function flush() {
  if (pool) persist(pool);
}

/**
 * Pair two personas for a fresh game. Draws ONLY from the active rotation
 * subset (first activeCount() agents). Within that subset, prefers least-
 * recently-played personas so every active agent eventually gets play time.
 */
export function matchAgents(exclude: Set<string>): [Agent, Agent] | null {
  const allActive = [...getPool().values()]
    .slice(0, activeCount())
    .filter((a) => !exclude.has(a.id));
  if (allActive.length < 2) return null;

  // Sort by lastPlayedAt ascending so personas that haven't played in a while
  // (or never have) get priority. Untouched personas sort to the front.
  const byRecency = [...allActive].sort(
    (a, b) => (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0),
  );

  // Prefer never-played agents first. This makes MIN_ACTIVE_AGENTS mean
  // "cover at least this many personas" before the same small cohort recycles.
  const leastPlayedAt = byRecency[0].lastPlayedAt ?? 0;
  const freshWave = byRecency.filter(
    (a) => (a.lastPlayedAt ?? 0) === leastPlayedAt,
  );
  const rotationBase = freshWave.length >= 2 ? freshWave : byRecency;
  const rotationPoolSize = Math.min(
    rotationBase.length,
    Math.max(2, Math.min(40, Math.ceil(rotationBase.length * 0.2))),
  );
  const rotationPool = rotationBase.slice(0, rotationPoolSize);

  const upset = Math.random() < 0.15;
  let a: Agent;
  let b: Agent;
  if (upset) {
    a = rotationPool[Math.floor(Math.random() * rotationPool.length)];
    do {
      b = rotationPool[Math.floor(Math.random() * rotationPool.length)];
    } while (b.id === a.id);
  } else {
    a = rotationPool[Math.floor(Math.random() * rotationPool.length)];
    const band = rotationBase.filter(
      (x) => x.id !== a.id && Math.abs(x.elo - a.elo) <= 200,
    );
    const candidates =
      band.length > 0 ? band : rotationBase.filter((x) => x.id !== a.id);
    b = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const now = Date.now();
  a.lastPlayedAt = now;
  b.lastPlayedAt = now;
  saveAgent(a);
  saveAgent(b);
  return [a, b];
}

export function listAgents(): Agent[] {
  return [...getPool().values()];
}

export function getAgent(id: string): Agent | undefined {
  return getPool().get(id);
}

export function leaderboard(limit = 25): Agent[] {
  return listAgents()
    .filter((a) => a.record.wins + a.record.losses + a.record.draws > 0)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit);
}
