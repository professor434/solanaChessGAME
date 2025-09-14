import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GamepadIcon, 
  Users, 
  Bot, 
  Trophy, 
  Wallet,
  Play,
  Crown,
  Coins
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';

import ChessGame from '@/components/ChessGame';
import GameLobby from '@/components/GameLobby';
import WalletConnect from '@/components/WalletConnect';
import { RealSolanaIntegration, GamePool } from '@/lib/real-wallet-integration';

export default function Index() {
  const { connected, publicKey } = useWallet();
  const [currentView, setCurrentView] = useState<'home' | 'lobby' | 'game'>('home');
  const [currentGame, setCurrentGame] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'bot'>('bot');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [solanaIntegration] = useState(() => new RealSolanaIntegration('devnet'));

  // Reset to home when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setCurrentView('home');
      setCurrentGame(null);
    }
  }, [connected]);

  const handlePlayBot = (difficulty: 'easy' | 'medium' | 'hard') => {
    setBotDifficulty(difficulty);
    setGameMode('bot');
    setCurrentGame({
      gameId: `bot_${Date.now()}`,
      mode: 'bot',
      difficulty,
      players: [publicKey?.toString() || 'Player', 'BOT'],
      entranceFee: 0,
      isPlayerWhite: Math.random() > 0.5
    });
    setCurrentView('game');
    toast.success(`Starting game against ${difficulty} bot!`);
  };

  const handleGameCreated = (gamePool: GamePool) => {
    setGameMode('multiplayer');
    setCurrentGame({
      gameId: gamePool.gameId,
      mode: 'multiplayer',
      gamePool,
      players: gamePool.players,
      entranceFee: gamePool.entranceFee,
      isPlayerWhite: true,
      waitingForOpponent: gamePool.players.length < 2
    });
    
    if (gamePool.players.length < 2) {
      toast.success('Game created! Waiting for opponent...');
      // Stay in lobby view to show waiting state
    } else {
      setCurrentView('game');
      toast.success('Game started!');
    }
  };

  const handleGameJoined = (gamePool: GamePool) => {
    setGameMode('multiplayer');
    setCurrentGame({
      gameId: gamePool.gameId,
      mode: 'multiplayer',
      gamePool,
      players: gamePool.players,
      entranceFee: gamePool.entranceFee,
      isPlayerWhite: gamePool.players[1] === publicKey?.toString(),
      waitingForOpponent: false
    });
    setCurrentView('game');
    toast.success('Joined game successfully!');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setCurrentGame(null);
  };

  const handleBackToLobby = () => {
    setCurrentView('lobby');
    setCurrentGame(null);
  };

  // Home View - Landing page with game options
  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Crown className="h-12 w-12 text-yellow-600" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Solana Chess
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Play chess with real SOL stakes or practice against AI bots. Connect your wallet to get started!
            </p>
          </div>

          {/* Wallet Connection */}
          <div className="max-w-md mx-auto mb-12">
            <WalletConnect />
          </div>

          {/* Game Modes */}
          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="bot" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="bot" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Practice vs Bot
                </TabsTrigger>
                <TabsTrigger value="multiplayer" className="flex items-center gap-2" disabled={!connected}>
                  <Users className="h-4 w-4" />
                  Multiplayer
                </TabsTrigger>
              </TabsList>

              {/* Bot Games Tab */}
              <TabsContent value="bot" className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Practice Against AI</h2>
                  <p className="text-muted-foreground">Free games to improve your skills</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Easy Bot */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handlePlayBot('easy')}>
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-2 p-3 bg-green-100 rounded-full w-fit">
                        <Bot className="h-8 w-8 text-green-600" />
                      </div>
                      <CardTitle className="text-green-600">Easy Bot</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-3">
                      <Badge variant="secondary" className="bg-green-50 text-green-700">Free</Badge>
                      <p className="text-sm text-muted-foreground">
                        Perfect for beginners. Makes random moves and basic captures.
                      </p>
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <Play className="h-4 w-4 mr-2" />
                        Play Easy
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Medium Bot */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handlePlayBot('medium')}>
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-2 p-3 bg-yellow-100 rounded-full w-fit">
                        <Bot className="h-8 w-8 text-yellow-600" />
                      </div>
                      <CardTitle className="text-yellow-600">Medium Bot</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-3">
                      <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Free</Badge>
                      <p className="text-sm text-muted-foreground">
                        Good for practice. Prefers captures and defends pieces.
                      </p>
                      <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                        <Play className="h-4 w-4 mr-2" />
                        Play Medium
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Hard Bot */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handlePlayBot('hard')}>
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-2 p-3 bg-red-100 rounded-full w-fit">
                        <Bot className="h-8 w-8 text-red-600" />
                      </div>
                      <CardTitle className="text-red-600">Hard Bot</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-3">
                      <Badge variant="secondary" className="bg-red-50 text-red-700">Free</Badge>
                      <p className="text-sm text-muted-foreground">
                        Challenging opponent. Uses strategy and controls center.
                      </p>
                      <Button className="w-full bg-red-600 hover:bg-red-700">
                        <Play className="h-4 w-4 mr-2" />
                        Play Hard
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Multiplayer Tab */}
              <TabsContent value="multiplayer" className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Play for Real SOL</h2>
                  <p className="text-muted-foreground">Create or join games with entrance fees</p>
                </div>

                {connected ? (
                  <div className="text-center">
                    <Button 
                      size="lg" 
                      onClick={() => setCurrentView('lobby')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Users className="h-5 w-5 mr-2" />
                      Enter Game Lobby
                    </Button>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">Connect your wallet to play multiplayer games</p>
                      <WalletMultiButton />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Features */}
          <div className="max-w-4xl mx-auto mt-16">
            <h3 className="text-2xl font-semibold text-center mb-8">Game Features</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="text-center p-6">
                  <GamepadIcon className="h-10 w-10 mx-auto mb-3 text-blue-600" />
                  <h4 className="font-semibold mb-2">Complete Chess</h4>
                  <p className="text-sm text-muted-foreground">
                    Full chess rules with checkmate, stalemate, and draw detection
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="text-center p-6">
                  <Coins className="h-10 w-10 mx-auto mb-3 text-yellow-600" />
                  <h4 className="font-semibold mb-2">Real SOL Stakes</h4>
                  <p className="text-sm text-muted-foreground">
                    Play with real Solana tokens. Winner takes 90% of the pot
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="text-center p-6">
                  <Trophy className="h-10 w-10 mx-auto mb-3 text-purple-600" />
                  <h4 className="font-semibold mb-2">Smart Bots</h4>
                  <p className="text-sm text-muted-foreground">
                    Three AI difficulty levels for practice and skill improvement
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby View - Multiplayer game lobby
  if (currentView === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Game Lobby</h1>
              <p className="text-muted-foreground">Create or join multiplayer games</p>
            </div>
            <Button variant="outline" onClick={handleBackToHome}>
              ← Back to Home
            </Button>
          </div>

          <GameLobby
            solanaIntegration={solanaIntegration}
            onGameCreated={handleGameCreated}
            onGameJoined={handleGameJoined}
          />
        </div>
      </div>
    );
  }

  // Game View - Active chess game
  if (currentView === 'game' && currentGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">
                {currentGame.mode === 'bot' 
                  ? `vs ${currentGame.difficulty} Bot` 
                  : `Multiplayer Game`
                }
              </h1>
              {currentGame.entranceFee > 0 && (
                <p className="text-muted-foreground">
                  Prize Pool: {(currentGame.entranceFee * 2).toFixed(4)} SOL
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={currentGame.mode === 'bot' ? handleBackToHome : handleBackToLobby}
            >
              ← Back
            </Button>
          </div>

          <ChessGame
            gameId={currentGame.gameId}
            mode={currentGame.mode}
            botDifficulty={currentGame.difficulty}
            isPlayerWhite={currentGame.isPlayerWhite}
            solanaIntegration={solanaIntegration}
            gamePool={currentGame.gamePool}
            onGameEnd={(result) => {
              toast.success(`Game ended: ${result.winner === 'draw' ? 'Draw' : result.winner + ' wins!'}`);
              setTimeout(() => {
                if (currentGame.mode === 'bot') {
                  handleBackToHome();
                } else {
                  handleBackToLobby();
                }
              }, 3000);
            }}
          />
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        <p className="text-muted-foreground">Initializing chess game</p>
      </div>
    </div>
  );
}