import Express from 'express'
import gameStartSchema, { gameJoinSchema } from './validations.js'
import { PrismaClient } from '../prisma/generated/prisma/client.js'
import cors from 'cors'
import { randomUUID } from 'crypto'

const app = Express()

const prisma = new PrismaClient()

// Middleware
app.use(cors({
  origin: "https://ajay-games-toe-66.vercel.app/"
}))
app.use(Express.json())

// Helper function to generate a unique game code
function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Health check endpoint
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      health: 'ok',
      database: 'connected'
    })
  } catch (error) {
    res.status(500).json({
      health: 'error',
      database: 'disconnected'
    })
  }
})

// Start a new game
app.post("/start", async (req, res) => {
  try {
    const result = gameStartSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: result.error.issues
      })
    }

    const { name } = result.data
    const gameId = randomUUID()
    const gameCode = generateGameCode()
    const userId = randomUUID()
    const baseUrl = process.env.SERVER_URL || "http://localhost:3100"

    // Create game in database
    const game = await prisma.game.create({
      data: {
        id: gameId,
        state: "_________", // 9 empty cells
        gameCode: gameCode,
        roomUrl: `${baseUrl}/game/${gameCode}`,
        users: {
          create: {
            id: userId,
            name: name
          }
        }
      },
      include: {
        users: true
      }
    })

    // Return user and game data
    res.json({
      success: true,
      user: {
        id: userId,
        name: name,
        symbol: "X" // First player is always X
      },
      game: {
        gameId: game.id,
        gameCode: game.gameCode,
        gameUrl: game.roomUrl,
        state: game.state,
        users: [{
          id: userId,
          name: name,
          symbol: "X"
        }],
        currentPlayer: "X"
      }
    })
  } catch (error) {
    console.error("Error starting game:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create game"
    })
  }
})

// Join an existing game
app.post("/join", async (req, res) => {
  try {
    const result = gameJoinSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: result.error.issues
      })
    }

    const { name, gameCode } = result.data

    // Find the game by game code
    const game = await prisma.game.findFirst({
      where: { gameCode: gameCode },
      include: { users: true }
    })

    if (!game) {
      return res.status(404).json({
        success: false,
        error: "Game not found"
      })
    }

    // Check if game is full
    if (game.users.length >= 2) {
      return res.status(400).json({
        success: false,
        error: "Game is full"
      })
    }

    // Add user to the game
    const userId = randomUUID()
    await prisma.user.create({
      data: {
        id: userId,
        name: name,
        gameId: game.id
      }
    })

    // Fetch updated game with all users
    const updatedGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: { users: true }
    })

    res.json({
      success: true,
      user: {
        id: userId,
        name: name,
        symbol: "O" // Second player is always O
      },
      game: {
        gameId: updatedGame!.id,
        gameCode: updatedGame!.gameCode,
        gameUrl: updatedGame!.roomUrl,
        state: updatedGame!.state,
        users: updatedGame!.users.map((u, idx) => ({
          id: u.id,
          name: u.name,
          symbol: idx === 0 ? "X" : "O"
        })),
        currentPlayer: "X"
      }
    })
  } catch (error) {
    console.error("Error joining game:", error)
    res.status(500).json({
      success: false,
      error: "Failed to join game"
    })
  }
})

// Get game state by ID
app.get("/score/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { users: true }
    })

    if (!game) {
      return res.status(404).json({
        success: false,
        error: "Game not found"
      })
    }

    res.json({
      success: true,
      game: {
        gameId: game.id,
        gameCode: game.gameCode,
        gameUrl: game.roomUrl,
        state: game.state,
        winner: game.winner,
        users: game.users.map((u, idx) => ({
          id: u.id,
          name: u.name,
          symbol: idx === 0 ? "X" : "O",
          score: u.score
        }))
      }
    })
  } catch (error) {
    console.error("Error fetching game:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch game"
    })
  }
})

// Get leaderboard - top users by score (aggregated by name)
app.get("/leaderboard", async (_req, res) => {
  try {
    // Aggregate scores by user name
    const aggregatedUsers = await prisma.user.groupBy({
      by: ['name'],
      _sum: {
        score: true
      },
      orderBy: {
        _sum: {
          score: 'desc'
        }
      },
      take: 10
    })

    // Format the response
    const leaderboard = aggregatedUsers.map((user, index) => ({
      id: `${user.name}-${index}`, // Unique ID for frontend
      name: user.name,
      score: user._sum.score || 0
    }))

    res.json({
      success: true,
      leaderboard: leaderboard
    })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard"
    })
  }
})


export { app };

