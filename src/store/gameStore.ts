import { create } from "zustand";
import type { Agent, GameState, PlatformStats } from "@/types";

interface ChainError {
  message: string;
  at: number;
}

export type ChainMode = "live" | "mock";

interface GameStoreState {
  games: GameState[];
  agents: Record<string, Agent>;
  leaderboard: Agent[];
  stats: PlatformStats;
  selectedGameId: number | null;
  connected: boolean;
  learningMode: boolean;
  lastEventAt: number;
  chainError: ChainError;
  mode: ChainMode;
  missingEnv: string[];
  paused: boolean;

  setSnapshot: (data: {
    games: GameState[];
    agents: Record<string, Agent>;
    leaderboard: Agent[];
    stats: PlatformStats;
    chainError?: ChainError;
    mode?: ChainMode;
    missingEnv?: string[];
    paused?: boolean;
  }) => void;
  selectGame: (id: number | null) => void;
  setConnected: (v: boolean) => void;
  toggleLearningMode: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  games: [],
  agents: {},
  leaderboard: [],
  stats: {
    totalGames: 0,
    totalMoves: 0,
    totalTxns: 0,
    pendingTxns: 0,
    chain: "base-sepolia",
  },
  selectedGameId: null,
  connected: false,
  learningMode: true,
  lastEventAt: 0,
  chainError: { message: "", at: 0 },
  mode: "mock",
  missingEnv: [],
  paused: false,

  setSnapshot: (data) => {
    const prev = get();

    // Monotonic stats: never let counters decrease (e.g. when an SSE
    // reconnect lands on a freshly-booted lambda whose totalGames has not
    // caught up to chain yet). Keep the maximum we've ever seen.
    const stats: PlatformStats = {
      ...data.stats,
      totalGames: Math.max(prev.stats.totalGames, data.stats.totalGames),
      totalMoves: Math.max(prev.stats.totalMoves, data.stats.totalMoves),
      totalTxns: Math.max(prev.stats.totalTxns, data.stats.totalTxns),
    };

    // If the lambda answering this snapshot has not yet rehydrated its
    // active games (returns [] but we already know about some), preserve
    // the previous view so the user doesn't see an empty grid for a beat.
    const games = data.games.length === 0 && prev.games.length > 0
      ? prev.games
      : data.games;

    const next: Partial<GameStoreState> = {
      games,
      agents: { ...prev.agents, ...data.agents },
      leaderboard: data.leaderboard.length > 0 ? data.leaderboard : prev.leaderboard,
      stats,
      chainError: data.chainError ?? prev.chainError,
      mode: data.mode ?? prev.mode,
      missingEnv: data.missingEnv ?? prev.missingEnv,
      paused: data.paused ?? false,
      lastEventAt: Date.now(),
    };
    // Auto-select the first game on initial snapshot.
    if (prev.selectedGameId == null && games.length > 0) {
      next.selectedGameId = games[0].id;
    }
    // If the currently selected game has ended (gone from the list), pick another.
    if (
      prev.selectedGameId != null &&
      !games.some((g) => g.id === prev.selectedGameId)
    ) {
      next.selectedGameId = games[0]?.id ?? null;
    }
    set(next);
  },

  selectGame: (id) => set({ selectedGameId: id }),
  setConnected: (v) => set({ connected: v }),
  toggleLearningMode: () => set((s) => ({ learningMode: !s.learningMode })),
}));
