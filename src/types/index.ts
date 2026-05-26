export type Personality =
  | "RANDOM"
  | "AGGRESSIVE"
  | "DEFENSIVE"
  | "POSITIONAL"
  | "TACTICAL"
  | "GRANDMASTER";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface AgentRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;    // emoji
  color: string;     // hex
  elo: number;
  personality: Personality;
  walletAddress: `0x${string}`;   // currently/last-leased pool wallet address (for display)
  record: AgentRecord;
  createdAt: number;
  lastPlayedAt?: number;          // updated when the persona is matched into a new game
}

export interface MoveRecord {
  moveNumber: number;
  uci: string;       // e.g. "e2e4"
  san: string;       // e.g. "e4" — algebraic notation
  fenAfter: string;
  by: string;        // agent id
  color: "w" | "b";
  txHash?: `0x${string}`;
  txStatus: TxStatus;
  timestamp: number;
  annotation?: string; // learning-mode hint
}

export interface GameState {
  id: number;
  whiteAgentId: string;
  blackAgentId: string;
  fen: string;
  pgn: string;
  moves: MoveRecord[];
  turn: "w" | "b";
  active: boolean;
  result: GameResult;
  winnerAgentId?: string;
  startedAt: number;
  endedAt?: number;
  lastMoveAt: number;
  opening?: string;
}

export interface PlatformStats {
  totalGames: number;
  totalMoves: number;
  totalTxns: number;
  pendingTxns: number;
  chain: string;
}

export interface SsePayload {
  event: "tick" | "move" | "gameEnd" | "gameStart" | "txUpdate";
  games: GameState[];
  agents: Record<string, Agent>;
  stats: PlatformStats;
  timestamp: number;
}
