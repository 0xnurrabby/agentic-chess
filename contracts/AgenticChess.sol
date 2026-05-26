// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgenticChess
 * @notice Onchain record of every move played by AI agents on the AgenticChess platform.
 *         Designed to be deployed standalone via Remix IDE to Base / Base Sepolia.
 *         Gas is sponsored via Coinbase Paymaster (ERC-7677) at the UserOperation layer,
 *         so this contract requires no paymaster-specific hooks.
 *
 *         Anyone can call playMove for any gameId — the platform's agent wallets are
 *         the only entities producing structured calls, and the platform UI filters
 *         by known agent addresses. Keep the surface minimal and event-driven.
 */
contract AgenticChess {
    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event GameStarted(
        uint256 indexed gameId,
        address indexed whiteAgent,
        address indexed blackAgent,
        uint256 timestamp
    );

    event MovePlayed(
        uint256 indexed gameId,
        address indexed agentAddress,
        string move,        // UCI notation e.g. "e2e4"
        string fen,         // full FEN after the move
        uint256 moveNumber,
        uint256 timestamp
    );

    event GameEnded(
        uint256 indexed gameId,
        address indexed winner, // address(0) for draw
        string result,          // "1-0", "0-1", "1/2-1/2"
        uint256 totalMoves,
        uint256 timestamp
    );

    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    struct Game {
        uint256 id;
        address whiteAgent;
        address blackAgent;
        string currentFen;
        uint256 moveCount;
        bool active;
        string result;
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    mapping(uint256 => Game) public games;
    mapping(uint256 => string[]) private _gameMoves;

    uint256 public totalGames;
    uint256 public totalMoves;

    string public constant STARTING_FEN =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    // ---------------------------------------------------------------
    // External: write
    // ---------------------------------------------------------------

    /// @notice Start a new game between two agents.
    function startGame(uint256 gameId, address white, address black) external {
        require(white != address(0) && black != address(0), "zero agent");
        require(games[gameId].id == 0 && games[gameId].whiteAgent == address(0), "exists");

        games[gameId] = Game({
            id: gameId,
            whiteAgent: white,
            blackAgent: black,
            currentFen: STARTING_FEN,
            moveCount: 0,
            active: true,
            result: ""
        });

        totalGames += 1;
        emit GameStarted(gameId, white, black, block.timestamp);
    }

    /// @notice Record a single move and its resulting FEN.
    function playMove(uint256 gameId, string calldata move, string calldata newFen) external {
        Game storage g = games[gameId];
        require(g.active, "inactive");
        require(msg.sender == g.whiteAgent || msg.sender == g.blackAgent, "not an agent");

        // White moves on even counts (0,2,4…); black on odd.
        if (g.moveCount % 2 == 0) {
            require(msg.sender == g.whiteAgent, "white turn");
        } else {
            require(msg.sender == g.blackAgent, "black turn");
        }

        g.currentFen = newFen;
        g.moveCount += 1;
        _gameMoves[gameId].push(move);

        totalMoves += 1;
        emit MovePlayed(gameId, msg.sender, move, newFen, g.moveCount, block.timestamp);
    }

    /// @notice End a game with the given result string.
    function endGame(uint256 gameId, address winner, string calldata result) external {
        Game storage g = games[gameId];
        require(g.active, "inactive");
        require(
            msg.sender == g.whiteAgent || msg.sender == g.blackAgent,
            "not an agent"
        );

        g.active = false;
        g.result = result;

        emit GameEnded(gameId, winner, result, g.moveCount, block.timestamp);
    }

    // ---------------------------------------------------------------
    // External: read
    // ---------------------------------------------------------------

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getGameMoves(uint256 gameId) external view returns (string[] memory) {
        return _gameMoves[gameId];
    }

    function getStats() external view returns (uint256 games_, uint256 moves_) {
        return (totalGames, totalMoves);
    }
}
