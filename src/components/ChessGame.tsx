import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Bot, Trophy, AlertCircle } from 'lucide-react';
import ChessBoard from './ChessBoard';
import { ChessGame as ChessGameLogic, PieceColor, ChessPosition } from '@/lib/chess-logic';
import { SolanaGameManager, GameResult, WalletState, GameRoom } from '@/lib/solana-integration';
import { toast } from 'sonner';

// Generate unique game ID
const generateGameId = (): string => {
  return `chess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

type BotDifficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'bot' | 'multiplayer';

interface ChessGameProps {
  gameMode: GameMode;
  botDifficulty?: BotDifficulty;
  gameRoom?: GameRoom | null;
  walletState: WalletState;
  onGameEnd: (result: 'win' | 'lose' | 'draw', winner?: string) => void;
}

export default function ChessGame({ 
  gameMode, 
  botDifficulty = 'medium', 
  gameRoom, 
  walletState,
  onGameEnd 
}: ChessGameProps) {
  const [game] = useState(() => new ChessGameLogic());
  const [gameState, setGameState] = useState(game.getGameState());
  const [selectedSquare, setSelectedSquare] = useState<ChessPosition | null>(null);
  const [validMoves, setValidMoves] = useState<ChessPosition[]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'checkmate' | 'stalemate' | 'draw'>('playing');
  const [winner, setWinner] = useState<PieceColor | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [whiteTime, setWhiteTime] = useState(600); // 10 minutes in seconds
  const [blackTime, setBlackTime] = useState(600);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [gameId] = useState(() => generateGameId());
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!isTimerActive || gameStatus !== 'playing') return;

    const interval = setInterval(() => {
      if (gameState.currentPlayer === 'white') {
        setWhiteTime(prev => {
          if (prev <= 1) {
            setGameStatus('checkmate');
            setWinner('black');
            setIsTimerActive(false);
            handleGameEnd('lose', gameRoom?.opponent || 'bot');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 1) {
            setGameStatus('checkmate');
            setWinner('white');
            setIsTimerActive(false);
            handleGameEnd('win', walletState.publicKey || 'player');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.currentPlayer, isTimerActive, gameStatus]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getValidMovesForPosition = (position: ChessPosition): ChessPosition[] => {
    // Get all valid moves from the game state
    const allMoves = game.getAllValidMoves(gameState.currentPlayer);
    
    // Filter moves that start from the selected position
    return allMoves
      .filter(move => move.from.row === position.row && move.from.col === position.col)
      .map(move => move.to);
  };

  const makeBotMove = useCallback(async () => {
    if (gameStatus !== 'playing' || gameState.currentPlayer !== 'black' || gameMode !== 'bot') {
      return;
    }

    setIsBotThinking(true);
    
    // Add a delay to simulate bot thinking
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    const allPossibleMoves = game.getAllValidMoves('black');

    if (allPossibleMoves.length === 0) {
      setIsBotThinking(false);
      return;
    }

    // Simple bot logic based on difficulty
    let selectedMove;
    
    if (botDifficulty === 'easy') {
      // Random move
      selectedMove = allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
    } else if (botDifficulty === 'medium') {
      // Prefer captures, otherwise random
      const captureMoves = allPossibleMoves.filter(move => {
        const targetPiece = gameState.board[move.to.row][move.to.col];
        return targetPiece && targetPiece.color === 'white';
      });
      
      selectedMove = captureMoves.length > 0 
        ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
        : allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
    } else {
      // Hard: More strategic (still simplified)
      const captureMoves = allPossibleMoves.filter(move => {
        const targetPiece = gameState.board[move.to.row][move.to.col];
        return targetPiece && targetPiece.color === 'white';
      });
      
      const centerMoves = allPossibleMoves.filter(move => {
        const { row, col } = move.to;
        return (col === 3 || col === 4) && (row === 3 || row === 4);
      });
      
      selectedMove = captureMoves.length > 0 
        ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
        : centerMoves.length > 0 
        ? centerMoves[Math.floor(Math.random() * centerMoves.length)]
        : allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
    }

    // Make the bot move
    const moveResult = game.makeMove(selectedMove.from, selectedMove.to);
    
    if (moveResult) {
      const newGameState = game.getGameState();
      setGameState(newGameState);
      
      // Add move to history
      const moveNotation = `${String.fromCharCode(97 + selectedMove.from.col)}${8 - selectedMove.from.row}-${String.fromCharCode(97 + selectedMove.to.col)}${8 - selectedMove.to.row}`;
      setMoveHistory(prev => [...prev, `Bot: ${moveNotation}`]);
      
      // Check game status
      if (newGameState.gameStatus === 'checkmate') {
        setGameStatus('checkmate');
        setWinner(newGameState.winner);
        setIsTimerActive(false);
        handleGameEnd('lose', 'bot');
      } else if (newGameState.gameStatus === 'stalemate') {
        setGameStatus('stalemate');
        setIsTimerActive(false);
        handleGameEnd('draw');
      } else if (newGameState.gameStatus === 'draw') {
        setGameStatus('draw');
        setIsTimerActive(false);
        handleGameEnd('draw');
      }
    }
    
    setIsBotThinking(false);
  }, [gameState, gameStatus, botDifficulty, game, gameMode]);

  // Effect to trigger bot moves
  useEffect(() => {
    if (gameMode === 'bot' && gameState.currentPlayer === 'black' && gameStatus === 'playing' && !isBotThinking) {
      makeBotMove();
    }
  }, [gameState.currentPlayer, gameMode, gameStatus, isBotThinking, makeBotMove]);

  const handleSquareClick = useCallback((position: ChessPosition) => {
    if (gameStatus !== 'playing' || isBotThinking) return;
    
    // In bot mode, only allow white pieces to be moved by human
    if (gameMode === 'bot' && gameState.currentPlayer === 'black') {
      toast.error("Wait for bot to move!");
      return;
    }
    
    // In multiplayer, only allow moves for the current player
    if (gameMode === 'multiplayer' && gameRoom) {
      const isPlayerWhite = gameRoom.creator === walletState.publicKey;
      const isPlayerTurn = (isPlayerWhite && gameState.currentPlayer === 'white') || 
                          (!isPlayerWhite && gameState.currentPlayer === 'black');
      
      if (!isPlayerTurn) {
        toast.error("It's not your turn!");
        return;
      }
    }

    if (selectedSquare) {
      // Try to make a move
      const moveResult = game.makeMove(selectedSquare, position);
      
      if (moveResult) {
        const newGameState = game.getGameState();
        setGameState(newGameState);
        setSelectedSquare(null);
        setValidMoves([]);
        
        // Add move to history
        const moveNotation = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}-${String.fromCharCode(97 + position.col)}${8 - position.row}`;
        setMoveHistory(prev => [...prev, moveNotation]);
        
        // Check game status
        if (newGameState.gameStatus === 'checkmate') {
          setGameStatus('checkmate');
          setWinner(newGameState.winner);
          setIsTimerActive(false);
          const result = newGameState.winner === 'white' ? 'win' : 'lose';
          const gameWinner = result === 'win' ? walletState.publicKey || 'player' : (gameRoom?.opponent || 'bot');
          handleGameEnd(result, gameWinner);
        } else if (newGameState.gameStatus === 'stalemate') {
          setGameStatus('stalemate');
          setIsTimerActive(false);
          handleGameEnd('draw');
        } else if (newGameState.gameStatus === 'draw') {
          setGameStatus('draw');
          setIsTimerActive(false);
          handleGameEnd('draw');
        }
        // Note: Bot move will be triggered by useEffect when currentPlayer changes to 'black'
      } else {
        toast.error('Invalid move');
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      // Select a piece - only allow selection of current player's pieces
      const piece = gameState.board[position.row][position.col];
      
      if (piece && piece.color === gameState.currentPlayer) {
        // In bot mode, only allow white pieces to be selected
        if (gameMode === 'bot' && piece.color === 'black') {
          toast.error("You can only move white pieces!");
          return;
        }
        
        setSelectedSquare(position);
        const moves = getValidMovesForPosition(position);
        setValidMoves(moves);
      }
    }
  }, [selectedSquare, gameState, gameStatus, gameMode, gameRoom, walletState.publicKey, isBotThinking]);

  const handleGameEnd = async (result: 'win' | 'lose' | 'draw', gameWinner?: string) => {
    try {
      // Record game result
      const gameResult: GameResult = {
        winner: result === 'win' ? 'white' : result === 'lose' ? 'black' : 'draw',
        moves: moveHistory.length,
        timestamp: Date.now(),
        whitePlayer: walletState.publicKey || 'player',
        blackPlayer: gameRoom?.opponent || 'bot'
      };

      // Store result locally
      const existingResults = JSON.parse(localStorage.getItem('chess_game_results') || '[]');
      existingResults.push(gameResult);
      localStorage.setItem('chess_game_results', JSON.stringify(existingResults));

      onGameEnd(result, gameWinner);
    } catch (error) {
      console.error('Error handling game end:', error);
      onGameEnd(result, gameWinner);
    }
  };

  const handleResign = () => {
    setGameStatus('checkmate');
    setWinner(gameState.currentPlayer === 'white' ? 'black' : 'white');
    setIsTimerActive(false);
    const result = gameState.currentPlayer === 'white' ? 'lose' : 'win';
    const gameWinner = result === 'win' ? walletState.publicKey || 'player' : (gameRoom?.opponent || 'bot');
    handleGameEnd(result, gameWinner);
  };

  const getStatusMessage = () => {
    if (isBotThinking) {
      return `Bot is thinking...`;
    } else if (gameStatus === 'checkmate') {
      return winner === 'white' ? 'White wins by checkmate!' : 'Black wins by checkmate!';
    } else if (gameStatus === 'stalemate') {
      return 'Game ended in stalemate!';
    } else if (gameStatus === 'draw') {
      return 'Game ended in a draw!';
    } else if (gameState.gameStatus === 'check') {
      return `${gameState.currentPlayer === 'white' ? 'White' : 'Black'} is in check!`;
    } else {
      if (gameMode === 'bot') {
        return gameState.currentPlayer === 'white' ? 'Your turn (White)' : 'Bot is thinking...';
      } else {
        return `${gameState.currentPlayer === 'white' ? 'White' : 'Black'} to move`;
      }
    }
  };

  const getPlayerInfo = (color: 'white' | 'black') => {
    if (gameMode === 'bot') {
      return color === 'white' ? 'You' : `${botDifficulty} Bot`;
    } else if (gameRoom) {
      const isCreatorWhite = gameRoom.creator === walletState.publicKey;
      if (color === 'white') {
        return isCreatorWhite ? 'You' : (gameRoom.opponent ? 'Opponent' : 'Waiting...');
      } else {
        return !isCreatorWhite ? 'You' : (gameRoom.opponent ? 'Opponent' : 'Waiting...');
      }
    }
    return color === 'white' ? 'White' : 'Black';
  };

  return (
    <div className="space-y-4">
      {/* Game Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {gameStatus !== 'playing' ? (
                <Trophy className="h-5 w-5 text-yellow-600" />
              ) : gameState.gameStatus === 'check' ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : isBotThinking ? (
                <Bot className="h-5 w-5 text-blue-600 animate-pulse" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600" />
              )}
              <span className="font-medium">{getStatusMessage()}</span>
            </div>
            
            {gameStatus === 'playing' && !isBotThinking && (
              <Button variant="outline" size="sm" onClick={handleResign}>
                Resign
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Player Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Black Player */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {gameMode === 'bot' ? (
                    <Bot className={`h-4 w-4 ${isBotThinking && gameState.currentPlayer === 'black' ? 'animate-pulse text-blue-600' : ''}`} />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="font-medium">{getPlayerInfo('black')}</span>
                  {isBotThinking && gameState.currentPlayer === 'black' && (
                    <span className="text-xs text-blue-600">Thinking...</span>
                  )}
                </div>
                <Badge variant={gameState.currentPlayer === 'black' ? 'default' : 'secondary'}>
                  {formatTime(blackTime)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* White Player */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{getPlayerInfo('white')}</span>
                </div>
                <Badge variant={gameState.currentPlayer === 'white' ? 'default' : 'secondary'}>
                  {formatTime(whiteTime)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Game Info */}
          {gameRoom && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Game Info</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Entrance Fee:</span>
                  <span className="font-medium">{gameRoom.entranceFee} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Prize Pool:</span>
                  <span className="font-medium">{(gameRoom.entranceFee * 2).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Winner Gets:</span>
                  <span className="font-medium text-green-600">{(gameRoom.entranceFee * 1.8).toFixed(4)} SOL</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chess Board */}
        <div className="lg:col-span-2">
          <ChessBoard
            gameState={gameState}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            isFlipped={gameMode === 'multiplayer' && gameRoom?.creator !== walletState.publicKey}
          />
        </div>

        {/* Move History */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Move History</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {moveHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No moves yet</p>
                ) : (
                  moveHistory.map((move, index) => (
                    <div key={index} className="text-xs font-mono">
                      {index + 1}. {move}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}