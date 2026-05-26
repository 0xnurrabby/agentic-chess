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

  setSnapshot: (data: {
    games: GameState[];
    agents: Record<string, Agent>;
    leaderboard: Agent[];
    stats: PlatformStats;
    chainError?: ChainError;
    mode?: ChainMode;
    missingEnv?: string[];
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

  setSnapshot: (data) => {
    const prev = get();
    const next: Partial<GameStoreState> = {
      games: data.games,
      agents: { ...prev.agents, ...data.agents },
      leaderboard: data.leaderboard,
      stats: data.stats,
      chainError: data.chainError ?? prev.chainError,
      mode: data.mode ?? prev.mode,
      missingEnv: data.missingEnv ?? prev.missingEnv,
      lastEventAt: Date.now(),
    };
    // Auto-select the first game on initial snapshot.
    if (prev.selectedGameId == null && data.games.length > 0) {
      next.selectedGameId = data.games[0].id;
    }
    // If the currently selected game has ended (gone from the list), pick another.
    if (
      prev.selectedGameId != null &&
      !data.games.some((g) => g.id === prev.selectedGameId)
    ) {
      next.selectedGameId = data.games[0]?.id ?? null;
    }
    set(next);
  },

  selectGame: (id) => set({ selectedGameId: id }),
  setConnected: (v) => set({ connected: v }),
  toggleLearningMode: () => set((s) => ({ learningMode: !s.learningMode })),
}));
