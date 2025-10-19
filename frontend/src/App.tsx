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
    <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 h-fit" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-gray-900 mb-6 text-3xl font-bold text-center">Leaderboard</h2>
      <div className="mb-6">
        {leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex justify-between items-center py-4 px-5 my-2 rounded-lg border transition-all hover:border-primary hover:translate-x-1 ${
                index === 0 ? 'bg-amber-50 border-amber-400' :
                index === 1 ? 'bg-gray-100 border-gray-300' :
                index === 2 ? 'bg-orange-100 border-orange-400' :
                'bg-gray-50 border-gray-200'
              }`}
            >
              <span className={`font-bold text-xl min-w-[50px] ${index === 0 ? 'text-amber-700' : 'text-gray-500'}`}>#{index + 1}</span>
              <span className="flex-1 font-semibold text-gray-700">{entry.name}</span>
              <span className="font-bold text-lg text-primary">{entry.score} pts</span>
            </div>
          ))
        ) : (
          <p>No players yet. Be the first to play!</p>
        )}
      </div>
    </div>);


  const renderBoard = () => {
    if (!currentGame) return null;

    return (
      <div className="inline-grid grid-cols-3 gap-3 p-4 bg-white rounded-xl shadow-lg border border-gray-200">
        {currentGame.state.split('').map((cell, index) => (
          <button
            key={index}
            className={`w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 font-bold text-5xl sm:text-6xl text-gray-900 cursor-pointer rounded-lg transition-all flex items-center justify-center border-2 ${
              cell !== '_'
                ? 'bg-white border-gray-300'
                : 'bg-gray-50 border-gray-200 hover:enabled:bg-gray-100 hover:enabled:border-primary hover:enabled:scale-[1.02]'
            } disabled:cursor-not-allowed`}
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
    <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-200">
      <h1 className="text-gray-900 mb-10 text-4xl font-bold text-center">Tic Tac Toe</h1>
      <div className="my-6">
        <input
          type="text"
          placeholder="Enter your name"
          required
          className="w-full py-3.5 px-4 border-[1.5px] border-gray-300 rounded-lg text-base transition-all bg-white text-gray-900 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </div>
      <div className="my-6">
        <button
          onClick={startGame}
          disabled={!playerName.trim()}
          className="w-full bg-primary text-white border-none py-3.5 px-6 rounded-lg text-base font-semibold cursor-pointer transition-all hover:enabled:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Start New Game
        </button>
      </div>
      <div className="my-8 relative text-center text-gray-400 font-medium text-sm">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200"></div>
        <span className="bg-white px-4 relative z-10">OR</span>
      </div>
      <div className="my-6">
        <input
          type="text"
          placeholder="Enter game code"
          className="w-full py-3.5 px-4 border-[1.5px] border-gray-300 rounded-lg text-base transition-all bg-white text-gray-900 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
        />
      </div>
      <div className="my-6">
        <button
          onClick={joinGame}
          disabled={!playerName.trim() || !gameCode.trim()}
          className="w-full bg-primary text-white border-none py-3.5 px-6 rounded-lg text-base font-semibold cursor-pointer transition-all hover:enabled:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Join Game
        </button>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 max-w-[1000px] mx-auto pr-0 lg:pr-[370px] items-start">
      {/* Left Panel - Game Details */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">Game Info</h3>
          <div className="my-4">
            <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1 block">Game Code:</span>
            <span className="text-base text-gray-900 font-semibold">{currentGame?.gameCode}</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">Players</h3>
          <div className={`flex items-center gap-3 py-3.5 px-3.5 my-2 bg-gray-50 rounded-lg border-2 transition-all ${currentGame?.currentPlayer === 'X' ? 'bg-indigo-50 border-primary' : 'border-transparent'}`}>
            <span className={`w-10 h-10 flex items-center justify-center rounded-md font-bold text-xl border-2 ${currentGame?.currentPlayer === 'X' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-gray-200'}`}>X</span>
            <span className="flex-1 font-medium text-gray-700">{currentGame?.users.find(u => u.symbol === 'X')?.name || 'Waiting...'}</span>
            {currentGame?.currentPlayer === 'X' && <span className="bg-primary text-white text-[0.625rem] font-semibold py-1 px-2 rounded uppercase tracking-wider whitespace-nowrap">Current Player</span>}
          </div>
          <div className={`flex items-center gap-3 py-3.5 px-3.5 my-2 bg-gray-50 rounded-lg border-2 transition-all ${currentGame?.currentPlayer === 'O' ? 'bg-indigo-50 border-primary' : 'border-transparent'}`}>
            <span className={`w-10 h-10 flex items-center justify-center rounded-md font-bold text-xl border-2 ${currentGame?.currentPlayer === 'O' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-gray-200'}`}>O</span>
            <span className="flex-1 font-medium text-gray-700">{currentGame?.users.find(u => u.symbol === 'O')?.name || 'Waiting...'}</span>
            {currentGame?.currentPlayer === 'O' && <span className="bg-primary text-white text-[0.625rem] font-semibold py-1 px-2 rounded uppercase tracking-wider whitespace-nowrap">Current Player</span>}
          </div>
        </div>

        {gameState === 'game-over' && (
          <div className="mt-6">
            <h3 className="mb-4 text-xl font-semibold">{message}</h3>
            <button onClick={resetGame} className="w-full bg-green-500 text-white border-none py-3 px-6 rounded-lg text-base font-semibold cursor-pointer transition-all hover:bg-green-600">Play Again</button>
          </div>
        )}
      </div>

      {/* Center Panel - Game Board */}
      <div className="flex flex-col items-center justify-center">
        {gameState === 'waiting' && (
          <div className="mb-8 p-8 bg-amber-50 border border-amber-400 rounded-lg text-amber-900 text-center max-w-md">
            <p className="my-2">Waiting for another player to join...</p>
            <p className="my-2">Share this code: <strong className="text-xl text-amber-700">{currentGame?.gameCode}</strong></p>
          </div>
        )}
        {renderBoard()}
      </div>

      {/* Right Panel - Chat Window */}
      {gameState !== 'waiting' && (
        <div className={`fixed right-0 top-0 h-screen z-[100] ${chatOpen ? 'w-[350px]' : 'w-auto'}`}>
          {!chatOpen && (
            <button
              className="fixed right-8 top-8 bg-primary text-white border-none py-3 px-5 rounded-lg cursor-pointer font-semibold shadow-lg shadow-primary/30 transition-all z-[100] hover:bg-primary-dark"
              onClick={() => setChatOpen(true)}
            >
              💬
            </button>
          )}
          {chatOpen && (
            <div className="bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.08)] border-l border-gray-200 flex flex-col h-full w-[350px] overflow-hidden">
              <div className="bg-gray-50 text-gray-900 py-4 px-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="m-0 text-lg font-semibold">Chat</h3>
                <button
                  className="bg-transparent border-none text-gray-500 cursor-pointer text-2xl p-1 leading-none transition-colors hover:text-gray-900"
                  onClick={() => setChatOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-gray-50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`py-2.5 px-3.5 rounded-lg border max-w-[85%] break-words ${msg.sender === currentUser?.name ? 'self-end bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}
                  >
                    <strong className="text-primary font-semibold text-sm block mb-1">{msg.sender}:</strong>
                    <span className="text-gray-900">{msg.message}</span>
                  </div>
                ))}
              </div>
              <div className="flex p-4 gap-2 bg-white border-t border-gray-200">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 py-2.5 px-3.5 border-[1.5px] border-gray-300 rounded-lg text-sm transition-all text-gray-900 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <button
                  onClick={sendChatMessage}
                  className="bg-primary text-white border-none py-2.5 px-4 rounded-lg cursor-pointer font-semibold transition-all hover:bg-primary-dark"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-8 min-h-screen">
      {message && (
        <div className={`bg-white text-gray-900 border border-gray-300 rounded-lg py-4 px-6 mb-6 font-medium shadow-sm ${
          gameState === 'game-over' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-primary'
        }`}>
          {message}
        </div>
      )}

      {gameState === 'menu' ? (
        <div className="grid grid-cols-2 gap-8 max-w-[1000px] mx-auto my-16 items-start">
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
