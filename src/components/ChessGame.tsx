import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Users, Clock, ArrowLeft, Flag, HandHeart, Bot } from 'lucide-react';
import { toast } from 'sonner';
import ChessBoard from './ChessBoard';
import GameResults from './GameResults';
import { 
  GameState, 
  ChessPosition, 
  initializeGame, 
  makeMove, 
  getValidMoves, 
  isGameOver, 
  getGameResult 
} from '@/lib/chess-logic';
import { SolanaGameManager, GameRoom, WalletState } from '@/lib/solana-integration';

interface ChessGameProps {
  gameMode: 'multiplayer' | 'bot';
  gameRoom?: GameRoom | null;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  walletState: WalletState;
  onGameEnd: () => void;
}

export default function ChessGame({ gameMode, gameRoom, botDifficulty = 'medium', walletState, onGameEnd }: ChessGameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<ChessPosition | null>(null);
  const [validMoves, setValidMoves] = useState<ChessPosition[]>([]);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [solanaManager] = useState(() => new SolanaGameManager());

  // Initialize game
  useEffect(() => {
    try {
      const initialState = initializeGame();
      if (!initialState || !initialState.board) {
        console.error('Failed to initialize game state');
        toast.error('Failed to initialize chess game');
        return;
      }
      
      setGameState(initialState);
      
      if (gameMode === 'multiplayer' && gameRoom) {
        // Determine player color for multiplayer
        const isCreator = gameRoom.creator === walletState.publicKey;
        const color = isCreator ? 'white' : 'black';
        setPlayerColor(color);
        setIsPlayerTurn(color === 'white');
      } else {
        // Bot game - player is always white
        setPlayerColor('white');
        setIsPlayerTurn(true);
      }
      
      setGameStarted(true);
      
      console.log('Game initialized:', { 
        gameMode,
        playerColor: gameMode === 'bot' ? 'white' : (gameRoom?.creator === walletState.publicKey ? 'white' : 'black'),
        isPlayerTurn: gameMode === 'bot' ? true : (gameRoom?.creator === walletState.publicKey),
        gameState: initialState 
      });
    } catch (error) {
      console.error('Error initializing game:', error);
      toast.error('Failed to initialize chess game');
    }
  }, [gameMode, gameRoom, walletState.publicKey]);

  // Check for game over
  useEffect(() => {
    if (!gameState || !gameStarted) return;

    try {
      const gameOverResult = isGameOver(gameState);
      if (gameOverResult.isGameOver) {
        setGameResult(gameOverResult.result);
        handleGameEnd(gameOverResult.result);
      }
    } catch (error) {
      console.error('Error checking game over:', error);
    }
  }, [gameState, gameStarted]);

  // Bot move logic
  useEffect(() => {
    if (gameMode === 'bot' && gameState && !isPlayerTurn && !gameResult && gameStarted) {
      // Bot makes a move after a short delay
      const botMoveTimer = setTimeout(() => {
        makeBotMove();
      }, 1000);

      return () => clearTimeout(botMoveTimer);
    }
  }, [gameMode, gameState, isPlayerTurn, gameResult, gameStarted]);

  const makeBotMove = () => {
    if (!gameState) return;

    try {
      // Get all possible moves for the bot (black pieces)
      const allMoves: { from: ChessPosition; to: ChessPosition }[] = [];
      
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = gameState.board[row][col];
          if (piece && piece.color === 'black') {
            const moves = getValidMoves(gameState, { row, col });
            moves.forEach(move => {
              allMoves.push({ from: { row, col }, to: move });
            });
          }
        }
      }

      if (allMoves.length === 0) return;

      let selectedMove;

      switch (botDifficulty) {
        case 'easy':
          // Random move
          selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
          break;
        
        case 'medium':
          // Prefer captures, otherwise random
          const captureMoves = allMoves.filter(move => 
            gameState.board[move.to.row][move.to.col] !== null
          );
          selectedMove = captureMoves.length > 0 
            ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
            : allMoves[Math.floor(Math.random() * allMoves.length)];
          break;
        
        case 'hard':
          // Advanced strategy: prefer center control, captures, and piece development
          const scoredMoves = allMoves.map(move => {
            let score = 0;
            
            // Prefer captures
            if (gameState.board[move.to.row][move.to.col]) {
              score += 10;
            }
            
            // Prefer center squares
            if ((move.to.row >= 3 && move.to.row <= 4) && (move.to.col >= 3 && move.to.col <= 4)) {
              score += 5;
            }
            
            // Prefer moving pieces forward
            if (move.to.row > move.from.row) {
              score += 2;
            }
            
            return { move, score };
          });
          
          const maxScore = Math.max(...scoredMoves.map(m => m.score));
          const bestMoves = scoredMoves.filter(m => m.score === maxScore);
          selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
          break;
        
        default:
          selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
      }

      // Make the bot move
      const newGameState = makeMove(gameState, selectedMove.from, selectedMove.to);
      if (newGameState) {
        setGameState(newGameState);
        setIsPlayerTurn(true);
        
        // Add move to history
        const moveNotation = `${String.fromCharCode(97 + selectedMove.from.col)}${8 - selectedMove.from.row}-${String.fromCharCode(97 + selectedMove.to.col)}${8 - selectedMove.to.row}`;
        setMoveHistory(prev => [...prev, moveNotation]);
        
        console.log(`Bot (${botDifficulty}) made move: ${moveNotation}`);
      }
    } catch (error) {
      console.error('Error making bot move:', error);
    }
  };

  const handleGameEnd = async (result: string) => {
    try {
      if (gameMode === 'bot' && walletState.publicKey) {
        // Record bot game result in stats
        let gameResult: 'win' | 'loss' | 'draw' = 'draw';
        
        if (result.includes('checkmate')) {
          const winnerColor = result.includes('White') ? 'white' : 'black';
          gameResult = winnerColor === playerColor ? 'win' : 'loss';
        } else if (result.includes('draw') || result.includes('stalemate')) {
          gameResult = 'draw';
        }
        
        await solanaManager.recordBotGameResult(walletState.publicKey, gameResult);
        console.log(`Bot game result recorded: ${gameResult}`);
        
      } else if (gameMode === 'multiplayer' && gameRoom) {
        // Handle multiplayer game completion
        let winner = '';
        let gameResult: 'win' | 'loss' | 'draw' = 'draw';

        if (result.includes('checkmate')) {
          const winnerColor = result.includes('White') ? 'white' : 'black';
          winner = winnerColor === playerColor ? walletState.publicKey! : (gameRoom.opponent || gameRoom.creator);
          gameResult = winnerColor === playerColor ? 'win' : 'loss';
        } else if (result.includes('draw') || result.includes('stalemate')) {
          gameResult = 'draw';
          winner = 'draw';
        }

        await solanaManager.completeGame(gameRoom.id, winner, gameResult);
      }
      
      toast.success(`Game ended: ${result}`);
    } catch (error) {
      console.error('Error handling game end:', error);
      toast.error('Error processing game result');
    }
  };

  const handleSquareClick = useCallback((position: ChessPosition) => {
    if (!gameState || !isPlayerTurn || gameResult) return;

    try {
      if (selectedSquare) {
        // Try to make a move
        if (validMoves.some(move => move.row === position.row && move.col === position.col)) {
          const newGameState = makeMove(gameState, selectedSquare, position);
          if (newGameState) {
            setGameState(newGameState);
            setSelectedSquare(null);
            setValidMoves([]);
            setIsPlayerTurn(gameMode === 'multiplayer' ? false : false); // In bot mode, bot will move next
            
            // Add move to history
            const moveNotation = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}-${String.fromCharCode(97 + position.col)}${8 - position.row}`;
            setMoveHistory(prev => [...prev, moveNotation]);
            
            console.log(`Player made move: ${moveNotation}`);
            
            // In multiplayer mode, simulate opponent move after delay (for testing)
            if (gameMode === 'multiplayer') {
              setTimeout(() => {
                setIsPlayerTurn(true); // Give turn back for testing
              }, 2000);
            }
          } else {
            toast.error('Invalid move');
          }
        } else {
          // Select new piece
          selectPiece(position);
        }
      } else {
        // Select a piece
        selectPiece(position);
      }
    } catch (error) {
      console.error('Error handling square click:', error);
      toast.error('Error making move');
    }
  }, [gameState, selectedSquare, validMoves, isPlayerTurn, gameResult, playerColor, gameMode]);

  const selectPiece = (position: ChessPosition) => {
    if (!gameState || !gameState.board) return;

    try {
      const piece = gameState.board[position.row]?.[position.col];
      if (piece && piece.color === playerColor) {
        setSelectedSquare(position);
        const moves = getValidMoves(gameState, position);
        setValidMoves(Array.isArray(moves) ? moves : []);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } catch (error) {
      console.error('Error selecting piece:', error);
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handleResign = async () => {
    try {
      if (gameMode === 'bot' && walletState.publicKey) {
        // Record resignation as loss in bot game
        await solanaManager.recordBotGameResult(walletState.publicKey, 'loss');
        setGameResult('You resigned');
        toast.info('You resigned from the game');
      } else if (gameMode === 'multiplayer' && gameRoom) {
        const opponent = gameRoom.creator === walletState.publicKey ? gameRoom.opponent : gameRoom.creator;
        await solanaManager.completeGame(gameRoom.id, opponent || '', 'loss');
        setGameResult('You resigned');
        toast.info('You resigned from the game');
      }
    } catch (error) {
      console.error('Error resigning:', error);
      toast.error('Error resigning from game');
    }
  };

  const handleOfferDraw = () => {
    toast.info('Draw offer sent to opponent (feature coming soon)');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Loading chess game...</p>
        </div>
      </div>
    );
  }

  if (gameResult) {
    return (
      <GameResults
        result={gameResult}
        playerColor={playerColor}
        gameRoom={gameRoom}
        moveHistory={moveHistory}
        onBackToLobby={onGameEnd}
        gameMode={gameMode}
        botDifficulty={botDifficulty}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <Button 
            variant="outline" 
            onClick={onGameEnd}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lobby
          </Button>
          
          <div className="flex items-center gap-2">
            {gameMode === 'bot' ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                vs {botDifficulty} Bot (Free)
              </Badge>
            ) : (
              <>
                <Badge variant="default" className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {gameRoom?.entranceFee} SOL
                </Badge>
                <Badge variant="secondary">
                  Prize: {((gameRoom?.entranceFee || 0) * 1.8).toFixed(4)} SOL
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-2 flex justify-center">
            <ChessBoard
              gameState={gameState}
              selectedSquare={selectedSquare}
              validMoves={validMoves}
              onSquareClick={handleSquareClick}
              isFlipped={playerColor === 'black'}
            />
          </div>

          {/* Game Info Sidebar */}
          <div className="space-y-4">
            {/* Players */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white border border-gray-400 rounded-full"></div>
                    <span className="text-sm">White</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {gameMode === 'bot' 
                      ? 'You' 
                      : (gameRoom?.creator === walletState.publicKey ? 'You' : formatAddress(gameRoom?.creator || ''))
                    }
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-800 rounded-full"></div>
                    <span className="text-sm">Black</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {gameMode === 'bot' 
                      ? `${botDifficulty} Bot`
                      : (gameRoom?.opponent === walletState.publicKey ? 'You' : 
                         gameRoom?.opponent ? formatAddress(gameRoom.opponent) : 'Waiting...')
                    }
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Game Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Game Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <Badge 
                    variant={isPlayerTurn ? "default" : "secondary"}
                    className="text-sm"
                  >
                    {isPlayerTurn ? `Your turn (${playerColor})` : 
                     gameMode === 'bot' ? "Bot's turn" : "Opponent's turn"}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="text-sm text-muted-foreground">
                  <div>Moves: {moveHistory.length}</div>
                  <div>Your color: {playerColor}</div>
                  <div>Mode: {gameMode === 'bot' ? `Bot (${botDifficulty})` : 'Multiplayer'}</div>
                </div>
              </CardContent>
            </Card>

            {/* Game Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gameMode === 'multiplayer' && (
                  <Button 
                    variant="outline" 
                    onClick={handleOfferDraw}
                    className="w-full flex items-center gap-2"
                    disabled={!isPlayerTurn}
                  >
                    <HandHeart className="h-4 w-4" />
                    Offer Draw
                  </Button>
                )}
                
                <Button 
                  variant="destructive" 
                  onClick={handleResign}
                  className="w-full flex items-center gap-2"
                >
                  <Flag className="h-4 w-4" />
                  Resign
                </Button>
              </CardContent>
            </Card>

            {/* Move History */}
            {moveHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Move History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-40 overflow-y-auto text-sm font-mono">
                    {moveHistory.map((move, index) => (
                      <div key={index} className="py-1">
                        {Math.floor(index / 2) + 1}. {move}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
