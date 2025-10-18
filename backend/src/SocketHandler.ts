import { createServer } from "http";
import { Server } from 'socket.io';
import { RoomHandler } from "./roomHandler.js";
import { app } from "./index.js";
import { PrismaClient } from '../prisma/generated/prisma/client.js';

const activeRooms = new Map<string, RoomHandler>();
const prisma = new PrismaClient();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://ajay-games-toe-66.vercel.app/", // Frontend URL
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Join room with game code
  socket.on("join-room", async (data) => {
    const { userId, gameCode, name } = data;
    console.log(`Player ${name} joining room ${gameCode}`);

    try {
      // If room doesn't exist in memory, try to load from database or create new
      if (!activeRooms.has(gameCode)) {
        // Check if game exists in database
        const existingGame = await prisma.game.findFirst({
          where: { gameCode: gameCode },
          include: { users: true }
        });

        if (existingGame && existingGame.users.length > 0) {
          // Load existing game into memory
          const firstUser = existingGame.users[0];
          const roomHandler = new RoomHandler(firstUser!.name, gameCode);

          // Set the existing game state from database
          roomHandler.loadFromDatabase(existingGame.id, existingGame.state, existingGame.users);

          activeRooms.set(gameCode, roomHandler);
          console.log(`Loaded existing game ${gameCode} from database with ${existingGame.users.length} users`);
        } else {
          // This shouldn't happen if /start or /join was called first
          console.warn(`No game found in database for code ${gameCode}, player ${name} may have skipped REST API`);
          socket.emit("room-joined", {
            success: false,
            error: "Game not found. Please create or join a game first."
          });
          return;
        }
      }

      const room = activeRooms.get(gameCode);
      if (room) {
        // Check if user is already in the room (reconnection scenario)
        const existingUser = room.getGame().users.find(u => u.id === userId);

        if (!existingUser) {
          // New user joining - add them to the in-memory room
          // Note: They should already be in the database from /join endpoint
          const success = room.addUser({ id: userId, name: name, symbol: "O" });

          if (!success) {
            socket.emit("room-joined", {
              success: false,
              error: "Room is full"
            });
            return;
          }

          console.log(`Added new player ${name} (${userId}) to room ${gameCode}`);
        } else {
          console.log(`Player ${name} (${userId}) reconnecting to room ${gameCode}`);
        }

        socket.join(gameCode);

        // Send current game state to the joining player
        socket.emit("room-joined", {
          success: true,
          game: room.getGame(),
          playerCount: room.getPlayerCount()
        });

        // Notify all players in the room about the player join/reconnect
        io.to(gameCode).emit("player-joined", {
          game: room.getGame(),
          playerCount: room.getPlayerCount()
        });

        console.log(`Player ${name} in room ${gameCode}. Total players: ${room.getPlayerCount()}`);
      } else {
        socket.emit("room-joined", {
          success: false,
          error: "Room not found"
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("room-joined", {
        success: false,
        error: "Failed to join room"
      });
    }
  });

  // Handle game moves
  socket.on("make-move", async (data) => {
    const { gameCode, position, playerId } = data;
    console.log(`Move made in room ${gameCode} at position ${position} by player ${playerId}`);

    const room = activeRooms.get(gameCode);
    if (room) {
      const moveResult = room.makeMove(position, playerId);
      
      if (moveResult.success) {
        // Update in-memory state
        room.updateState(moveResult.newState || "");

        // Update database
        await room.updateDB(room.getGame().gameId, moveResult.newState || "");

        // ALWAYS send the updated board state first so UI updates
        io.to(gameCode).emit("move-updated", {
          game: room.getGame(),
          currentPlayer: room.getCurrentPlayer()
        });

        // Check for winner AFTER updating the UI
        const winner = room.checkWinner();
        if (winner) {
          await room.declareResult(winner);

          // Emit game-over AFTER move-updated so the final move is visible
          io.to(gameCode).emit("game-over", {
            winner,
            game: room.getGame()
          });
        }
      } else {
        // Invalid move
        socket.emit("invalid-move", {
          error: moveResult.error
        });
      }
    }
  });

  // Handle chat messages
  socket.on("chat-message", (data) => {
    const { gameCode, sender, message } = data;
    console.log(`Chat message in room ${gameCode} from ${sender}: ${message}`);

    // Broadcast message to all players in the room
    io.to(gameCode).emit("chat-message", {
      sender,
      message,
      timestamp: Date.now()
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

// Start server on port 3100
server.listen(3100, () => {
  console.log("Server running on port 3100 with Socket.IO");
});

export { io, server };
