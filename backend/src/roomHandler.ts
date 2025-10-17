import { PrismaClient } from "../prisma/generated/prisma/client.js";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Define User model for in-memory tracking
interface User {
  id: string;
  name: string;
  symbol: "X" | "O";
}

interface Game {
  gameId: string;
  users: User[];
  state: string; // e.g. "XOXOX____"
  gameCode: string;
  gameUrl: string;
  winner?: string;
  currentPlayer: "X" | "O";
}

export class RoomHandler {
  private users: User[] = [];
  private game: Game;

  constructor(userName: string, gameCode: string) {
    const gameId = randomUUID(); // unique game ID for Prisma
    const baseUrl = process.env.SERVER_URL || "http://localhost:3200";

    // Create the first user (creator) - always gets X
    const user: User = {
      id: randomUUID(),
      name: userName,
      symbol: "X",
    };

    this.users.push(user);

    // Initialize the game
    this.game = {
      gameId,
      users: this.users,
      state: "_________", // 9 empty cells
      gameCode,
      gameUrl: `${baseUrl}/game/${gameCode}`,
      currentPlayer: "X", // X always starts
    };
  }

  /**
   * Save new game to DB
   */
  async createGameInDB(): Promise<void> {
    try {
      await prisma.game.create({
        data: {
          id: this.game.gameId,
          state: this.game.state,
          gameCode: this.game.gameCode, // Make sure this matches your Prisma schema
          roomUrl: this.game.gameUrl,
        },
      });
      console.log(` Game ${this.game.gameCode} created in DB`);
    } catch (error) {
      console.error(" Error creating game:", error);
    }
  }

  /**
   * Update game state in DB
   */
  async updateDB(gameId: string, state: string): Promise<void> {
    try {
      const updated = await prisma.game.update({
        where: { id: gameId },
        data: { state },
      });
      console.log(" Game updated in DB:", updated);
    } catch (error) {
      console.error("Error updating DB:", error);
    }
  }

  /**
   * Update cache (optional)
   */
  async updateCache(gameId: string, state: string): Promise<void> {
    console.log(`Cache updated for game ${gameId}: ${state}`);
  }

  /**
   * Declare a winner and save result to DB
   */
  async declareResult(winner: string): Promise<void> {
    this.game.winner = winner;
    console.log(`Game over! Winner: ${winner}`);

    try {
      await prisma.game.update({
        where: { id: this.game.gameId },
        data: { state: this.game.state, winner },
      });
    } catch (error) {
      console.error(" Error saving result:", error);
    }
  }

  /**
   * Add a new player
   */
  addUser(user: User): boolean {
    if (this.game.users.length < 2) {
      // Second player always gets O
      user.symbol = "O";
      this.game.users.push(user);
      return true;
    } else {
      console.warn("Room already full!");
      return false;
    }
  }

  /**
   * Update local board state
   */
  updateState(newState: string): void {
    this.game.state = newState;
  }

  /**
   * Get current game data
   */
  getGame(): Game {
    return this.game;
  }

  /**
   * Get current player count
   */
  getPlayerCount(): number {
    return this.game.users.length;
  }

  /**
   * Get current player
   */
  getCurrentPlayer(): "X" | "O" {
    return this.game.currentPlayer;
  }

  /**
   * Make a move on the board
   */
  makeMove(position: number, playerId: string): { success: boolean; newState?: string; error?: string } {
    // Validate position
    if (position < 0 || position > 8) {
      return { success: false, error: "Invalid position" };
    }

    // Check if position is already occupied
    if (this.game.state[position] !== "_") {
      return { success: false, error: "Position already occupied" };
    }

    // Find the player making the move
    const player = this.game.users.find(u => u.id === playerId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    // Check if it's the player's turn
    if (player.symbol !== this.game.currentPlayer) {
      return { success: false, error: "Not your turn" };
    }

    // Make the move
    const newState = this.game.state.split("");
    newState[position] = player.symbol;
    const updatedState = newState.join("");

    // Switch turns
    this.game.currentPlayer = this.game.currentPlayer === "X" ? "O" : "X";

    return { success: true, newState: updatedState };
  }

  /**
   * Check for winner
   */
  checkWinner(): string | null {
    const state = this.game.state.split('');
    const winningCombinations = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (a !== undefined && b !== undefined && c !== undefined && 
          state[a] !== "_" && state[a] === state[b] && state[b] === state[c]) {
        return state[a] || null;
      }
    }

    // Check for draw   
    if (!state.includes("_")) {
      return "draw";
    }

    return null;
  }
}

/**
 * Generate a short 6-character game code
 */
function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
