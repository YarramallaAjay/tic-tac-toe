import { createServer } from "http";
import { Server } from 'socket.io';
import { RoomHandler } from "./RoomHandler.js";
import app from "../dist/index.js";

const activeRooms = new Map<string, RoomHandler>();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Frontend URL
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Join room with game code
  socket.on("join-room", (data) => {
    const { userId, gameCode, name } = data;
    console.log(`Player ${name} joining room ${gameCode}`);

    // If room doesn't exist, create one
    if (!activeRooms.has(gameCode)) {
      activeRooms.set(gameCode, new RoomHandler(name, gameCode));
    }

    const room = activeRooms.get(gameCode);
    if (room) {
      // Add user to room
      const success = room.addUser({ id: userId, name: name, symbol: "O" });
      
      if (success) {
        socket.join(gameCode);
        
        // Send current game state to the joining player
        socket.emit("room-joined", {
          success: true,
          game: room.getGame(),
          playerCount: room.getPlayerCount()
        });

        // Notify all players in the room about the new player
        io.to(gameCode).emit("player-joined", {
          game: room.getGame(),
          playerCount: room.getPlayerCount()
        });

        console.log(`Player ${name} joined room ${gameCode}. Total players: ${room.getPlayerCount()}`);
      } else {
        socket.emit("room-joined", {
          success: false,
          error: "Room is full"
        });
      }
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
        
        // Check for winner
        const winner = room.checkWinner();
        if (winner) {
          await room.declareResult(winner);
          io.to(gameCode).emit("game-over", {
            winner,
            game: room.getGame()
          });
        } else {
          // Send updated game state to all players
          io.to(gameCode).emit("move-updated", {
            game: room.getGame(),
            currentPlayer: room.getCurrentPlayer()
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
