import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

interface User {
  id: string;
  name: string;
  symbol: "X" | "O";
}

interface Game {
  gameId: string;
  users: User[];
  state: string;
  gameCode: string;
  gameUrl: string;
  winner?: string;
  currentPlayer: "X" | "O";
}

type GameState = 'menu' | 'waiting' | 'playing' | 'game-over';

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3100');
    setSocket(newSocket);

    newSocket.on('room-joined', (data) => {
      if (data.success) {
        setCurrentGame(data.game);
        setGameState('waiting');
        setMessage(`Joined game room ${data.game.gameCode}. Waiting for another player...`);
      } else {
        setMessage(data.error);
      }
    });

    newSocket.on('player-joined', (data) => {
      setCurrentGame(data.game);
      if (data.playerCount === 2) {
        setGameState('playing');
        setMessage('Game started! Your turn to play.');
      }
    });

    newSocket.on('move-updated', (data) => {
      setCurrentGame(data.game);
      const isMyTurn = data.currentPlayer === currentUser?.symbol;
      setMessage(isMyTurn ? 'Your turn!' : 'Opponent\'s turn');
    });

    newSocket.on('game-over', (data) => {
      setWinner(data.winner);
      setGameState('game-over');
      if (data.winner === 'draw') {
        setMessage('Game ended in a draw!');
      } else {
        const isWinner = data.winner === currentUser?.symbol;
        setMessage(isWinner ? 'You won!' : 'You lost!');
      }
    });

    newSocket.on('invalid-move', (data) => {
      setMessage(data.error);
    });

    return () => {
      newSocket.close();
    };
  }, [currentUser]);

  const startGame = async () => {
    if (!playerName.trim()) {
      setMessage('Please enter your name');
      return;
    }

    try {
      const response = await fetch('http://localhost:3100/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim() })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentUser(data.user);
        setCurrentGame(data.game);
        setGameCode(data.game.gameCode);
        setMessage(`Game created! Share code: ${data.game.gameCode}`);
        
        // Join socket room
        socket?.emit('join-room', {
          userId: data.user.id,
          gameCode: data.game.gameCode,
          name: data.user.name
        });
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Failed to start game');
    }
  };

  const joinGame = async () => {
    if (!playerName.trim() || !gameCode.trim()) {
      setMessage('Please enter both name and game code');
      return;
    }

    try {
      const response = await fetch('http://localhost:3100/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), gameCode: gameCode.trim() })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentUser(data.user);
        setCurrentGame(data.game);
        setMessage(`Joining game ${data.game.gameCode}...`);
        
        // Join socket room
        socket?.emit('join-room', {
          userId: data.user.id,
          gameCode: data.game.gameCode,
          name: data.user.name
        });
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Failed to join game');
    }
  };

  const makeMove = (position: number) => {
    if (!currentGame || !currentUser || gameState !== 'playing') return;
    
    // Check if it's the player's turn
    if (currentGame.currentPlayer !== currentUser.symbol) {
      setMessage('Not your turn!');
      return;
    }

    socket?.emit('make-move', {
      gameCode: currentGame.gameCode,
      position,
      playerId: currentUser.id
    });
  };

  const resetGame = () => {
    setGameState('menu');
    setPlayerName('');
    setGameCode('');
    setCurrentGame(null);
    setCurrentUser(null);
    setMessage('');
    setWinner(null);
  };

  const renderBoard = () => {
    if (!currentGame) return null;

    return (
      <div className="game-board">
        {currentGame.state.split('').map((cell, index) => (
          <button
            key={index}
            className={`cell ${cell !== '_' ? 'occupied' : ''}`}
            onClick={() => makeMove(index)}
            disabled={cell !== '_' || gameState !== 'playing' || currentGame.currentPlayer !== currentUser?.symbol}
          >
            {cell === '_' ? '' : cell}
          </button>
        ))}
      </div>
    );
  };

  const renderMenu = () => (
    <div className="menu">
      <h1>Tic Tac Toe</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </div>
      <div className="button-group">
        <button onClick={startGame} disabled={!playerName.trim()}>
          Start New Game
        </button>
      </div>
      <div className="divider">
        <span>OR</span>
      </div>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter game code"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
        />
      </div>
      <div className="button-group">
        <button onClick={joinGame} disabled={!playerName.trim() || !gameCode.trim()}>
          Join Game
        </button>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="game">
      <div className="game-header">
        <h2>Game Code: {currentGame?.gameCode}</h2>
        <p>You are: {currentUser?.symbol}</p>
        <p>Current Player: {currentGame?.currentPlayer}</p>
      </div>
      
      <div className="players">
        <div className="player">
          <span>Player X: {currentGame?.users.find(u => u.symbol === 'X')?.name || 'Waiting...'}</span>
        </div>
        <div className="player">
          <span>Player O: {currentGame?.users.find(u => u.symbol === 'O')?.name || 'Waiting...'}</span>
        </div>
      </div>

      {renderBoard()}

      {gameState === 'waiting' && (
        <div className="waiting">
          <p>Waiting for another player to join...</p>
          <p>Share this code: <strong>{currentGame?.gameCode}</strong></p>
        </div>
      )}

      {gameState === 'game-over' && (
        <div className="game-over">
          <h3>{message}</h3>
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      {message && (
        <div className={`message ${gameState === 'game-over' ? 'game-over-message' : ''}`}>
          {message}
        </div>
      )}
      
      {gameState === 'menu' ? renderMenu() : renderGame()}
    </div>
  );
}

export default App;
