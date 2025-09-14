import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import WalletConnect from '@/components/WalletConnect';
import GameLobby from '@/components/GameLobby';
import ChessBoard from '@/components/ChessBoard';
import GameResults from '@/components/GameResults';

import { ChessGame, PieceColor } from '@/lib/chess-logic';
import { SolanaGameManager, GamePool, WalletState } from '@/lib/solana-integration';

type GamePhase = 'wallet' | 'lobby' | 'playing' | 'results';

export default function Game() {
  const navigate = useNavigate();
  const [gamePhase, setGamePhase] = useState<GamePhase>('wallet');
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });
  const [solanaManager] = useState(new SolanaGameManager());
  const [chessGame, setChessGame] = useState<ChessGame | null>(null);
  const [gamePool, setGamePool] = useState<GamePool | null>(null);
  const [playerColor, setPlayerColor] = useState<PieceColor>('white');
  const [gameWinner, setGameWinner] = useState<PieceColor | null>(null);

  useEffect(() => {
    // Update page title
    document.title = 'Solana Chess Game - Play & Earn';
  }, []);

  const handleWalletConnected = (wallet: WalletState) => {
    setWalletState(wallet);
    setGamePhase('lobby');
    toast.success('Wallet connected! Ready to play chess.');
  };

  const handleGameStart = (pool: GamePool, color: PieceColor) => {
    setGamePool(pool);
    setPlayerColor(color);
    const newGame = new ChessGame();
    newGame.startGame();
    setChessGame(newGame);
    setGamePhase('playing');
    
    toast.success(`Game started! You are playing as ${color === 'white' ? 'White ♔' : 'Black ♚'}`);
  };

  const handleGameEnd = (winner: PieceColor | null) => {
    setGameWinner(winner);
    setGamePhase('results');
    
    if (winner) {
      const isPlayerWinner = winner === playerColor;
      toast.success(
        isPlayerWinner 
          ? `Congratulations! You won as ${winner === 'white' ? 'White ♔' : 'Black ♚'}!` 
          : `Game over. ${winner === 'white' ? 'White ♔' : 'Black ♚'} wins.`
      );
    } else {
      toast.info('Game ended in a draw.');
    }
  };

  const handlePlayAgain = () => {
    setChessGame(null);
    setGamePool(null);
    setGameWinner(null);
    setGamePhase('lobby');
  };

  const handleBackToLobby = () => {
    setChessGame(null);
    setGamePool(null);
    setGameWinner(null);
    setGamePhase('lobby');
  };

  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'wallet':
        return (
          <div className="flex justify-center">
            <WalletConnect 
              onWalletConnected={handleWalletConnected}
              solanaManager={solanaManager}
            />
          </div>
        );

      case 'lobby':
        return (
          <GameLobby
            walletState={walletState}
            solanaManager={solanaManager}
            onGameStart={handleGameStart}
          />
        );

      case 'playing':
        return chessGame ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Game Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Chess Game in Progress</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Game ID: {gamePool?.gameId.slice(-8)}
                    </Badge>
                    <Badge variant="default">
                      Prize Pool: {gamePool?.totalAmount.toFixed(4)} SOL
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    You are playing as: <Badge variant="secondary">
                      {playerColor === 'white' ? '♔ White' : '♚ Black'}
                    </Badge>
                  </div>
                  <div>
                    Winner gets: <span className="font-semibold text-green-600">
                      {((gamePool?.totalAmount || 0) * 0.9).toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chess Board */}
            <div className="flex justify-center">
              <ChessBoard
                game={chessGame}
                playerColor={playerColor}
                onGameEnd={handleGameEnd}
              />
            </div>
          </div>
        ) : null;

      case 'results':
        return gamePool ? (
          <div className="flex justify-center">
            <GameResults
              winner={gameWinner}
              gamePool={gamePool}
              playerWallet={walletState.publicKey!}
              solanaManager={solanaManager}
              onPlayAgain={handlePlayAgain}
              onBackToLobby={handleBackToLobby}
            />
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
              
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Solana Chess
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Wallet Status */}
              {walletState.connected && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="hidden sm:flex">
                    {walletState.publicKey?.slice(0, 4)}...{walletState.publicKey?.slice(-4)}
                  </Badge>
                  <Badge variant="secondary">
                    {walletState.balance.toFixed(4)} SOL
                  </Badge>
                </div>
              )}

              {/* Game Phase Indicator */}
              <Badge variant="default" className="capitalize">
                {gamePhase === 'wallet' ? 'Connect Wallet' :
                 gamePhase === 'lobby' ? 'Game Lobby' :
                 gamePhase === 'playing' ? 'In Game' :
                 'Game Results'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {renderGamePhase()}
      </div>

      {/* Footer */}
      <div className="border-t bg-white/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              Powered by Solana Blockchain • Decentralized Chess Gaming
            </div>
            <div className="flex items-center gap-4">
              <span>Treasury: 7Ckn...LLDh</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open('https://explorer.solana.com/address/7CknuFiZJA4bWTivznW4CkB9ZP46GEoJKmy6KjRbLLDh?cluster=devnet', '_blank')}
              >
                View on Explorer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}