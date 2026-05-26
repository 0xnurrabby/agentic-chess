export const AGENTIC_CHESS_ABI = [
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "whiteAgent", type: "address", indexed: true },
      { name: "blackAgent", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MovePlayed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "agentAddress", type: "address", indexed: true },
      { name: "move", type: "string", indexed: false },
      { name: "fen", type: "string", indexed: false },
      { name: "moveNumber", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameEnded",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "result", type: "string", indexed: false },
      { name: "totalMoves", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "startGame",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "white", type: "address" },
      { name: "black", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "playMove",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "move", type: "string" },
      { name: "newFen", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "endGame",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "result", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getStats",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "games_", type: "uint256" },
      { name: "moves_", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getGame",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "whiteAgent", type: "address" },
          { name: "blackAgent", type: "address" },
          { name: "currentFen", type: "string" },
          { name: "moveCount", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "result", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getGameMoves",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "string[]" }],
  },
] as const;
