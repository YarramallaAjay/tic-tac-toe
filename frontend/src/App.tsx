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

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  // const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);

  // Initialize socket connection
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tic-tac-toe-production-8519.up.railway.app';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on('room-joined', (data) => {
      console.log('room-joined event received:', data);
      if (data.success) {
        setCurrentGame(data.game);
        setGameState('waiting');
        setMessage(`Joined game room ${data.game.gameCode}. Waiting for another player...`);
      } else {
        setMessage(data.error);
      }
    });

    newSocket.on('player-joined', (data) => {
      console.log('player-joined event received:', data);
      setCurrentGame(data.game);
      if (data.playerCount === 2) {
        console.log('Setting game state to playing');
        setGameState('playing');
        setMessage('Game started! Your turn to play.');
      } else {
        console.log('Player count is not 2, it is:', data.playerCount);
      }
    });

    newSocket.on('move-updated', (data) => {
      console.log('move-updated event received:', data);
      setCurrentGame(data.game);
      // Access currentUser from the closure - will use latest value
      setCurrentUser((user) => {
        const isMyTurn = data.currentPlayer === user?.symbol;
        setMessage(isMyTurn ? 'Your turn!' : 'Opponent\'s turn');
        return user;
      });
    });

    newSocket.on('game-over', (data) => {
      console.log('game-over event received:', data);
      setGameState('game-over');
      if (data.winner === 'draw') {
        setMessage('Game ended in a draw!');
      } else {
        // Access currentUser from the closure
        setCurrentUser((user) => {
          const isWinner = data.winner === user?.symbol;
          setMessage(isWinner ? 'You won!' : 'You lost!');
          return user;
        });
      }
    });

    newSocket.on('invalid-move', (data) => {
      console.log('invalid-move event received:', data);
      setMessage(data.error);
    });

    newSocket.on('chat-message', (data) => {
      console.log('chat-message received:', data);
      setChatMessages(prev => [...prev, {
        sender: data.sender,
        message: data.message,
        timestamp: Date.now()
      }]);
    });

    return () => {
      newSocket.close();
    };
  }, []); // Empty dependency array - only run once on mount

  // Fetch leaderboard
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tic-tac-toe-production-8519.up.railway.app';
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${backendUrl}/leaderboard`);
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.leaderboard);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };

    fetchLeaderboard();
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const startGame = async () => {
    if (!playerName.trim()) {
      setMessage('Please enter your name');
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tic-tac-toe-production-8519.up.railway.app';
    try {
      const response = await fetch(`${backendUrl}/start`, {
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

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tic-tac-toe-production-8519.up.railway.app';
      try {
        const response = await fetch(`${backendUrl}/join`, {
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

  const sendChatMessage = () => {
    if (!chatInput.trim() || !currentGame || !currentUser) return;

    socket?.emit('chat-message', {
      gameCode: currentGame.gameCode,
      sender: currentUser.name,
      message: chatInput.trim()
    });

    setChatInput('');
  };

  const resetGame = () => {
    setGameState('menu');
    setPlayerName('');
    setGameCode('');
    setCurrentGame(null);
    setCurrentUser(null);
    setMessage('');
    setChatMessages([]);
  };
  const renderLeaderboard = () => (
    <div className="leaderboard-content" onClick={(e) => e.stopPropagation()}>
      <h2>Leaderboard</h2>
      <div className="leaderboard-list">
        {leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <div key={entry.id} className="leaderboard-entry">
              <span className="rank">#{index + 1}</span>
              <span className="player-name">{entry.name}</span>
              <span className="score">{entry.score} pts</span>
            </div>
          ))
        ) : (
          <p>No players yet. Be the first to play!</p>
        )}
      </div>
      {/* <button onClick={() => setShowLeaderboard(false)} className="close-btn">Close</button> */}
    </div>);


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
          required
          color='black'
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
    <div className="game-container">
      {/* Left Panel - Game Details */}
      <div className="game-details">
        <div className="detail-section">
          <h3>Game Info</h3>
          <div className="detail-item">
            <span className="detail-label">Game Code:</span>
            <span className="detail-value">{currentGame?.gameCode}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">You are:</span>
            <span className="symbol-badge">{currentUser?.symbol}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Current Turn:</span>
            <span className={`symbol-badge ${currentGame?.currentPlayer === currentUser?.symbol ? 'active' : ''}`}>
              {currentGame?.currentPlayer}
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h3>Players</h3>
          <div className={`player-item ${currentGame?.currentPlayer === 'X' ? 'active-player' : ''}`}>
            <span className="player-symbol">X</span>
            <span className="player-name">{currentGame?.users.find(u => u.symbol === 'X')?.name || 'Waiting...'}</span>
          </div>
          <div className={`player-item ${currentGame?.currentPlayer === 'O' ? 'active-player' : ''}`}>
            <span className="player-symbol">O</span>
            <span className="player-name">{currentGame?.users.find(u => u.symbol === 'O')?.name || 'Waiting...'}</span>
          </div>
        </div>

        {gameState === 'game-over' && (
          <div className="game-over-section">
            <h3>{message}</h3>
            <button onClick={resetGame} className="play-again-btn">Play Again</button>
          </div>
        )}
      </div>

      {/* Center Panel - Game Board */}
      <div className="game-board-container">
        {gameState === 'waiting' && (
          <div className="waiting">
            <p>Waiting for another player to join...</p>
            <p>Share this code: <strong>{currentGame?.gameCode}</strong></p>
          </div>
        )}
        {renderBoard()}
      </div>

      {/* Right Panel - Chat Window */}
      {gameState !== 'waiting' && (
        <div className={`chat-container ${chatOpen ? 'open' : 'closed'}`}>
          {!chatOpen && (
            <button className="chat-toggle" onClick={() => setChatOpen(true)}>
              💬
            </button>
          )}
          {chatOpen && (
            <div className="chat-window">
              <div className="chat-header">
                <h3>Chat</h3>
                <button className="close-chat" onClick={() => setChatOpen(false)}>✕</button>
              </div>
              <div className="chat-messages">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.sender === currentUser?.name ? 'own-message' : ''}`}>
                    <strong>{msg.sender}:</strong> {msg.message}
                  </div>
                ))}
              </div>
              <div className="chat-input-container">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="chat-input"
                />
                <button onClick={sendChatMessage} className="send-btn">Send</button>
              </div>
            </div>
          )}
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

      {gameState === 'menu' ? (
        <div className="menu-container">
          {renderMenu()}
          {renderLeaderboard()}
        </div>
      ) : (
        renderGame()
      )}
    </div>
  );
}

export default App;
