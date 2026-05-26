import { Agent, Personality } from "@/types";
import { pick, randomBetween } from "@/lib/utils";

const NAMES_FIRST = [
  "Atlas", "Nova", "Orion", "Lyra", "Echo", "Pixel", "Zephyr", "Vega",
  "Sable", "Quartz", "Onyx", "Cipher", "Helix", "Argo", "Mira", "Sol",
  "Kite", "Riven", "Vex", "Juno", "Aria", "Brio", "Cinder", "Dune",
  "Ember", "Flux", "Glint", "Hex", "Iris", "Jade", "Knox", "Lumen",
  "Nyx", "Opal", "Pyre", "Quill", "Rune", "Stark", "Thorn", "Umbra",
  "Vale", "Wren", "Xeno", "Yara", "Zen", "Aether", "Borne", "Crisp",
];

const NAMES_SECOND = [
  "Bot", "AI", "X", "Prime", "Zero", "Nine", "MK2", "Neo",
  "Dynamo", "Forge", "Engine", "Logic", "Drift", "Pulse", "Spark", "Core",
];

const EMOJIS = [
  "🤖", "🦾", "🧠", "⚙️", "🔮", "✨", "🛸", "🪐",
  "🦊", "🐺", "🦅", "🦉", "🐉", "🦄", "🐙", "🦑",
  "♟️", "♞", "♛", "♚", "♜", "♝",
];

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#84cc16", "#10b981", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#a855f7",
];

const PERSONALITIES: Personality[] = [
  "RANDOM",
  "AGGRESSIVE",
  "DEFENSIVE",
  "POSITIONAL",
  "TACTICAL",
  "GRANDMASTER",
];

// ELO ranges per personality — lower personalities cluster lower, GMs cluster high.
const ELO_RANGES: Record<Personality, [number, number]> = {
  RANDOM: [600, 900],
  DEFENSIVE: [1000, 1600],
  POSITIONAL: [1300, 2000],
  AGGRESSIVE: [1200, 1900],
  TACTICAL: [1500, 2200],
  GRANDMASTER: [2200, 2800],
};

/**
 * Generate a pseudo-EVM address. Used for the in-memory agent pool when
 * MOCK_BLOCKCHAIN=true. In production, replace with a CDP-derived address.
 */
function generateMockAddress(): `0x${string}` {
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) out += chars[Math.floor(Math.random() * 16)];
  return out as `0x${string}`;
}

export function createAgent(idx: number): Agent {
  const personality = pick(PERSONALITIES);
  const [eloMin, eloMax] = ELO_RANGES[personality];
  const first = pick(NAMES_FIRST);
  const second = pick(NAMES_SECOND);

  return {
    id: `agent_${idx.toString().padStart(4, "0")}`,
    name: `${first}-${second}`,
    avatar: pick(EMOJIS),
    color: pick(COLORS),
    elo: randomBetween(eloMin, eloMax),
    personality,
    walletAddress: generateMockAddress(),
    record: { wins: 0, losses: 0, draws: 0 },
    createdAt: Date.now(),
  };
}

export function recordResult(
  a: Agent,
  result: "win" | "loss" | "draw",
  opponentElo: number,
): Agent {
  const next = { ...a, record: { ...a.record } };
  if (result === "win") next.record.wins += 1;
  if (result === "loss") next.record.losses += 1;
  if (result === "draw") next.record.draws += 1;

  // ELO update (k=24)
  const k = 24;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - a.elo) / 400));
  const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  next.elo = Math.round(a.elo + k * (score - expected));
  return next;
}

export function winRate(a: Agent): number {
  const { wins, losses, draws } = a.record;
  const total = wins + losses + draws;
  if (total === 0) return 0;
  return wins / total;
}
