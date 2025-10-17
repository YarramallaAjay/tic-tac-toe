import express from "express";
import { PrismaClient } from "../prisma/generated/prisma/client.js";
import { randomUUID } from "crypto";
import { server } from "./SocketHandler.js";

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/health", async (req, res) => {
    res.json({
        'Health': process.connected,
        'Status': 'OK'
    });
});

// Start game endpoint - creates user and game
app.post("/start", async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }

        // Check if user exists, if not create new user
        let user = await prisma.user.findFirst({
            where: { name }
        });

        if (!user) {
            user = await prisma.user.create({
                data: { name }
            });
        }

        // Generate game code and create game
        const gameCode = generateGameCode();
        const gameId = randomUUID();
        const gameUrl = `${process.env.SERVER_URL || "http://localhost:3200"}/game/${gameCode}`;

        const game = await prisma.game.create({
            data: {
                id: gameId,
                state: "_________",
                gameCode,
                roomUrl: gameUrl,
                users: {
                    connect: { id: user.id }
                }
            }
        });

        res.json({
            success: true,
            user: { id: user.id, name: user.name },
            game: {
                id: game.id,
                gameCode: game.gameCode,
                gameUrl: game.roomUrl,
                state: game.state
            }
        });

    } catch (error) {
        console.error("Error starting game:", error);
        res.status(500).json({ error: "Failed to start game" });
    }
});

// Join game endpoint
app.post("/join", async (req, res) => {
    try {
        const { name, gameCode } = req.body;
        
        if (!name || !gameCode) {
            return res.status(400).json({ error: "Name and game code are required" });
        }

        // Check if user exists, if not create new user
        let user = await prisma.user.findFirst({
            where: { name }
        });

        if (!user) {
            user = await prisma.user.create({
                data: { name }
            });
        }

        // Find game by game code
        const game = await prisma.game.findFirst({
            where: { gameCode },
            include: { users: true }
        });

        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        if (game.users.length >= 2) {
            return res.status(400).json({ error: "Game is full" });
        }

        // Add user to game
        await prisma.game.update({
            where: { id: game.id },
            data: {
                users: {
                    connect: { id: user.id }
                }
            }
        });

        res.json({
            success: true,
            user: { id: user.id, name: user.name },
            game: {
                id: game.id,
                gameCode: game.gameCode,
                gameUrl: game.roomUrl,
                state: game.state,
                playerCount: game.users.length + 1
            }
        });

    } catch (error) {
        console.error("Error joining game:", error);
        res.status(500).json({ error: "Failed to join game" });
    }
});

// Get game score/state
app.get("/score/:gameId", async (req, res) => {
    try {
        const { gameId } = req.params;
        
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { users: true }
        });

        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        res.json({
            success: true,
            game: {
                id: game.id,
                state: game.state,
                winner: game.winner,
                users: game.users
            }
        });

    } catch (error) {
        console.error("Error getting game score:", error);
        res.status(500).json({ error: "Failed to get game score" });
    }
});

// Helper function to generate game code
function generateGameCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// The server is already started in SocketHandler.ts
export default app;
