import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Bot, Trophy, AlertCircle, Play, Pause } from 'lucide-react';
import ChessBoard from './ChessBoard';
import { ChessGame as ChessGameLogic, PieceColor, ChessPosition } from '@/lib/chess-logic';
import { SolanaChessIntegration, GameResult, generateGameId } from '@/lib/solana-integration';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';

interface GameState {
  gameId: string;
  whitePlayer: string;
  blackPlayer: string;
  currentPlayer: PieceColor;
  gameStatus: string;
  wagerAmount: number;
  isPlayerVsBot: boolean;
  botDifficulty: 'easy' | 'medium' | 'hard';
}

interface ChessGameProps {
  gameState: GameState;
  onGameEnd: (result: GameResult) => void;
  onBackToLobby: () => void;
}

export default function ChessGame({ gameState, onGameEnd, onBackToLobby }: ChessGameProps) {
  const { publicKey, connected } = useWallet();
  const [chessGame] = useState(() => new ChessGameLogic());
  const [solanaIntegration] = useState(() => new SolanaChessIntegration());
  const [selectedSquare, setSelectedSquare] = useState<ChessPosition | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [gameStartTime] = useState(Date.now());
  const [gameTime, setGameTime] = useState(0);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [whiteTime, setWhiteTime] = useState(10 * 60 * 1000); // 10 minutes in ms
  const [blackTime, setBlackTime] = useState(10 * 60 * 1000); // 10 minutes in ms
  const [currentPlayerTime, setCurrentPlayerTime] = useState(whiteTime);
  const [botThinking, setBotThinking] = useState(false);

  // Game timer
  useEffect(() => {
    if (!gameStarted || isGamePaused || chessGame.isGameOver()) return;

    const timer = setInterval(() => {
      setGameTime(Date.now() - gameStartTime);
      
      // Update player time
      const currentPlayer = chessGame.getCurrentPlayer();
      if (currentPlayer === 'white') {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 1000);
          setCurrentPlayerTime(newTime);
          if (newTime === 0) {
            endGameByTimeout('black');
          }
          return newTime;
        });
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 1000);
          setCurrentPlayerTime(newTime);
          if (newTime === 0) {
            endGameByTimeout('white');
          }
          return newTime;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isGamePaused, chessGame.getCurrentPlayer(), gameStartTime]);

  // Start the game automatically
  useEffect(() => {
    if (!gameStarted) {
      setGameStarted(true);
      toast.success('Game started! White moves first.');
    }
  }, [gameStarted]);

  // Bot move logic for player vs bot games
  useEffect(() => {
    if (gameState.isPlayerVsBot && 
        chessGame.getCurrentPlayer() === 'black' && 
        chessGame.getGameStatus() === 'playing' &&
        gameStarted &&
        !chessGame.isGameOver()) {
      
      setBotThinking(true);
      // Delay bot move for better UX
      const delay = gameState.botDifficulty === 'easy' ? 1000 : 
                   gameState.botDifficulty === 'medium' ? 2000 : 3000;
      
      const timer = setTimeout(() => {
        makeBotMove();
        setBotThinking(false);
      }, delay);

      return () => {
        clearTimeout(timer);
        setBotThinking(false);
      };
    }
  }, [chessGame.getCurrentPlayer(), gameState.isPlayerVsBot, gameStarted]);

  const makeBotMove = useCallback(() => {
    const validMoves = chessGame.getAllValidMoves('black');
    
    if (validMoves.length === 0) {
      checkGameEnd();
      return;
    }

    let selectedMove;
    
    switch (gameState.botDifficulty) {
      case 'easy':
        // Random move
        selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        break;
      case 'medium':
        // Prefer captures, otherwise random
        const captures = validMoves.filter(move => 
          chessGame.getBoard()[move.to.row][move.to.col] !== null
        );
        selectedMove = captures.length > 0 
          ? captures[Math.floor(Math.random() * captures.length)]
          : validMoves[Math.floor(Math.random() * validMoves.length)];
        break;
      case 'hard':
        // Simple evaluation - prefer captures and center control
        selectedMove = getBestMove(validMoves);
        break;
      default:
        selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    if (selectedMove && chessGame.makeMove(selectedMove.from, selectedMove.to)) {
      setMoveCount(chessGame.getMoveCount());
      checkGameEnd();
      
      const piece = chessGame.getBoard()[selectedMove.to.row][selectedMove.to.col];
      const pieceSymbol = getPieceSymbol(piece);
      const toSquare = String.fromCharCode(97 + selectedMove.to.col) + (8 - selectedMove.to.row);
      toast.info(`Bot played: ${pieceSymbol} to ${toSquare}`);
    }
  }, [chessGame, gameState.botDifficulty]);

  const getBestMove = (moves: { from: ChessPosition; to: ChessPosition }[]) => {
    let bestMove = moves[0];
    let bestScore = -1000;
    const board = chessGame.getBoard();

    for (const move of moves) {
      let score = 0;
      
      // Prefer captures
      const targetPiece = board[move.to.row][move.to.col];
      if (targetPiece) {
        const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
        score += pieceValues[targetPiece.type] || 0;
      }
      
      // Prefer center control
      const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
      score += (7 - centerDistance) * 0.1;
      
      // Avoid edge moves for pieces other than pawns
      const piece = board[move.from.row][move.from.col];
      if (piece && piece.type !== 'pawn') {
        if (move.to.row === 0 || move.to.row === 7 || move.to.col === 0 || move.to.col === 7) {
          score -= 0.5;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  };

  const handleSquareClick = (row: number, col: number) => {
    if (chessGame.isGameOver() || isGamePaused) return;
    
    const position = { row, col };
    
    // If it's bot's turn, don't allow human moves
    if (gameState.isPlayerVsBot && chessGame.getCurrentPlayer() === 'black') {
      toast.warning("Wait for bot's move");
      return;
    }

    // If no square selected, select this square
    if (!selectedSquare) {
      const piece = chessGame.getBoard()[row][col];
      if (piece && piece.color === chessGame.getCurrentPlayer()) {
        setSelectedSquare(position);
      }
      return;
    }

    // If same square clicked, deselect
    if (selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null);
      return;
    }

    // Try to make a move
    if (chessGame.isValidMove(selectedSquare, position)) {
      if (chessGame.makeMove(selectedSquare, position)) {
        setMoveCount(chessGame.getMoveCount());
        setSelectedSquare(null);
        checkGameEnd();
        
        // Switch timer to next player
        const currentPlayer = chessGame.getCurrentPlayer();
        setCurrentPlayerTime(currentPlayer === 'white' ? whiteTime : blackTime);
      }
    } else {
      // Select new piece if it belongs to current player
      const piece = chessGame.getBoard()[row][col];
      if (piece && piece.color === chessGame.getCurrentPlayer()) {
        setSelectedSquare(position);
      } else {
        setSelectedSquare(null);
        toast.error('Invalid move');
      }
    }
  };

  const checkGameEnd = () => {
    const status = chessGame.getGameStatus();
    const winner = chessGame.getWinner();

    if (chessGame.isGameOver()) {
      const gameResult: GameResult = {
        winner: winner || 'draw',
        moves: chessGame.getMoveCount(),
        timestamp: Date.now(),
        whitePlayer: gameState.whitePlayer,
        blackPlayer: gameState.blackPlayer
      };

      // Handle prize distribution if there's a wager
      if (gameState.wagerAmount > 0 && connected && publicKey) {
        handlePrizeDistribution(gameResult);
      }

      onGameEnd(gameResult);
      
      if (status === 'checkmate') {
        toast.success(`Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins!`);
      } else if (status === 'stalemate') {
        toast.info('Game ended in stalemate (draw)');
      } else if (status === 'draw') {
        toast.info('Game ended in a draw');
      }
    }
  };

  const endGameByTimeout = (winner: PieceColor) => {
    const gameResult: GameResult = {
      winner,
      moves: chessGame.getMoveCount(),
      timestamp: Date.now(),
      whitePlayer: gameState.whitePlayer,
      blackPlayer: gameState.blackPlayer
    };

    onGameEnd(gameResult);
    toast.error(`Time's up! ${winner === 'white' ? 'White' : 'Black'} wins by timeout!`);
  };

  const handlePrizeDistribution = async (result: GameResult) => {
    try {
      if (!connected || !publicKey) return;

      const totalPrize = gameState.wagerAmount * 2;
      const platformFee = totalPrize * 0.1;
      const winnerPrize = totalPrize * 0.9;

      console.log('Prize Distribution:', {
        totalPrize,
        platformFee,
        winnerPrize,
        winner: result.winner
      });

      toast.success(`Prize of ${winnerPrize.toFixed(4)} SOL awarded to winner!`);
    } catch (error) {
      console.error('Error distributing prize:', error);
      toast.error('Error distributing prize');
    }
  };

  const togglePause = () => {
    setIsGamePaused(!isGamePaused);
    toast.info(isGamePaused ? 'Game resumed' : 'Game paused');
  };

  const getPlayerName = (color: PieceColor) => {
    if (color === 'white') {
      return gameState.whitePlayer;
    }
    return gameState.isPlayerVsBot ? `${gameState.botDifficulty.charAt(0).toUpperCase() + gameState.botDifficulty.slice(1)} Bot` : gameState.blackPlayer;
  };

  const getPlayerIcon = (color: PieceColor) => {
    if (color === 'white') {
      return <User className="h-4 w-4" />;
    }
    return gameState.isPlayerVsBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPieceSymbol = (piece: any): string => {
    if (!piece) return '';
    
    const symbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    
    return symbols[piece.color]?.[piece.type] || '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'check': return 'destructive';
      case 'checkmate': return 'destructive';
      case 'stalemate': return 'secondary';
      case 'draw': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Game Board */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Chess Game
                  {botThinking && (
                    <Badge variant="outline" className="animate-pulse">
                      Bot thinking...
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    disabled={chessGame.isGameOver()}
                  >
                    {isGamePaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isGamePaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-mono">{formatTime(gameTime)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChessBoard
                board={chessGame.getBoard()}
                onSquareClick={handleSquareClick}
                selectedSquare={selectedSquare}
                currentPlayer={chessGame.getCurrentPlayer()}
              />
            </CardContent>
          </Card>
        </div>

        {/* Game Info Panel */}
        <div className="space-y-4">
          {/* Player Timers */}
          <Card>
            <CardHeader>
              <CardTitle>Player Timers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                chessGame.getCurrentPlayer() === 'white' && !isGamePaused ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
              }`}>
                {getPlayerIcon('white')}
                <div className="flex-1">
                  <div className="font-medium">White</div>
                  <div className="text-sm text-muted-foreground">
                    {getPlayerName('white')}
                  </div>
                </div>
                <div className={`font-mono text-lg ${whiteTime < 60000 ? 'text-red-600' : ''}`}>
                  {formatTime(whiteTime)}
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                chessGame.getCurrentPlayer() === 'black' && !isGamePaused ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
              }`}>
                {getPlayerIcon('black')}
                <div className="flex-1">
                  <div className="font-medium">Black</div>
                  <div className="text-sm text-muted-foreground">
                    {getPlayerName('black')}
                  </div>
                </div>
                <div className={`font-mono text-lg ${blackTime < 60000 ? 'text-red-600' : ''}`}>
                  {formatTime(blackTime)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Status */}
          <Card>
            <CardHeader>
              <CardTitle>Game Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={getStatusColor(chessGame.getGameStatus())}>
                  {chessGame.getGameStatus()}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Moves:</span>
                <Badge variant="secondary">{chessGame.getMoveCount()}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Current Turn:</span>
                <Badge variant="outline">
                  {chessGame.getCurrentPlayer() === 'white' ? '♔ White' : '♚ Black'}
                </Badge>
              </div>

              {gameState.wagerAmount > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Wager:</span>
                    <Badge variant="outline">{gameState.wagerAmount} SOL</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Prize Pool:</span>
                    <Badge variant="default">{(gameState.wagerAmount * 2).toFixed(4)} SOL</Badge>
                  </div>
                </>
              )}

              {gameState.isPlayerVsBot && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span className="text-sm">Playing against Bot</span>
                    <Badge variant="outline" className="ml-auto">
                      {gameState.botDifficulty}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Move History */}
          <Card>
            <CardHeader>
              <CardTitle>Move History</CardTitle>
            </CardHeader>
            <CardContent>
              {chessGame.getGameState().moveHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No moves yet</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {chessGame.getGameState().moveHistory.map((move, index) => (
                    <div key={index} className="text-sm font-mono flex justify-between">
                      <span>{Math.floor(index / 2) + 1}.</span>
                      <span>{move}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Game Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                onClick={onBackToLobby}
                className="w-full"
              >
                Back to Lobby
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Are you sure you want to forfeit the game?')) {
                    const gameResult: GameResult = {
                      winner: chessGame.getCurrentPlayer() === 'white' ? 'black' : 'white',
                      moves: chessGame.getMoveCount(),
                      timestamp: Date.now(),
                      whitePlayer: gameState.whitePlayer,
                      blackPlayer: gameState.blackPlayer
                    };
                    onGameEnd(gameResult);
                    toast.info('Game forfeited');
                  }
                }}
                className="w-full"
                disabled={chessGame.isGameOver()}
              >
                Forfeit Game
              </Button>
            </CardContent>
          </Card>

          {/* Game Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Chess Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Click a piece to select it</p>
              <p>• Click a valid square to move</p>
              <p>• White moves first</p>
              <p>• Each player has 10 minutes</p>
              <p>• Win by checkmate or timeout</p>
              <p>• Game ends in stalemate if no legal moves</p>
              {gameState.isPlayerVsBot && (
                <p>• Bot will move automatically after you</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}