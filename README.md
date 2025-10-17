# Tic Tac Toe Game

A real-time multiplayer tic-tac-toe game built with React, Node.js, Socket.IO, and PostgreSQL.

## Features

- **Real-time multiplayer gameplay** using Socket.IO
- **User registration and game creation** with unique game codes
- **Move validation** to prevent invalid moves
- **Game state persistence** in PostgreSQL database
- **Responsive UI** with modern design
- **Turn-based gameplay** with proper player management

## Game Flow

1. **User Registration**: Players enter their name to register or join
2. **Game Creation**: First player creates a game and gets a unique game code
3. **Game Joining**: Second player joins using the game code
4. **Real-time Play**: Players take turns making moves with live updates
5. **Game Completion**: Winner is determined and game is saved to database

## Tech Stack

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time communication
- **Prisma** ORM with PostgreSQL
- **TypeScript** for type safety

### Frontend
- **React** with TypeScript
- **Socket.IO Client** for real-time updates
- **Modern CSS** with responsive design

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

## Setup Instructions

### 1. Database Setup

Create a PostgreSQL database and update the connection string in your environment variables:

```bash
# Create a .env file in the backend directory
DATABASE_URL="postgresql://username:password@localhost:5432/tictactoe"
SERVER_URL="http://localhost:3100"
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 3. Database Setup

```bash
# Navigate to backend directory
cd backend

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Build the project
npm run build
```

### 4. Start the Application

You have several options to run the application:

**Option 1: Run both backend and frontend together**
```bash
# From the root directory
npm run dev
```

**Option 2: Run backend and frontend separately**
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

**Option 3: Run individually**
```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev
```

- Backend runs on: `http://localhost:3100`
- Frontend runs on: `http://localhost:5173`

## How to Play

1. **Start a New Game**:
   - Enter your name
   - Click "Start New Game"
   - Share the generated game code with another player

2. **Join a Game**:
   - Enter your name and the game code
   - Click "Join Game"

3. **Play**:
   - Players take turns clicking on empty cells
   - The game validates moves and prevents invalid actions
   - Winner is determined when three in a row is achieved
   - Game ends in a draw if all cells are filled

## API Endpoints

### REST API
- `POST /start` - Create a new game
- `POST /join` - Join an existing game
- `GET /score/:gameId` - Get game state
- `GET /health` - Health check

### Socket.IO Events
- `join-room` - Join a game room
- `make-move` - Make a move on the board
- `room-joined` - Confirmation of room join
- `player-joined` - Another player joined
- `move-updated` - Game state updated
- `game-over` - Game completed

## Database Schema

### User Table
- `id` - Unique identifier
- `name` - Player name
- `gameId` - Associated game (nullable)

### Game Table
- `id` - Unique identifier
- `state` - Current board state (9-character string)
- `gameCode` - Unique game code for joining
- `roomUrl` - Game URL
- `winner` - Winner symbol (nullable)
- `users` - Associated users

## Project Structure

```
tic-tac-toe/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server and API routes
│   │   ├── SocketHandler.ts  # Socket.IO event handling
│   │   └── roomHandler.ts    # Game logic and state management
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── migrations/       # Database migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component
│   │   ├── App.css          # Game styles
│   │   └── main.tsx         # React entry point
│   └── package.json
└── README.md
```

## Development

### Running in Development Mode

1. Start the database
2. Run `npm run dev` in the backend directory
3. Run `npm run dev` in the frontend directory
4. Open `http://localhost:5173` in your browser

### Building for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.