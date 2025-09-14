import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Bot, Users, Wallet, Trophy, Gamepad2, Clock, Coins } from 'lucide-react';
import { toast } from 'sonner';

import WalletConnect from '@/components/WalletConnect';
import GameLobby from '@/components/GameLobby';
import ChessGame from '@/components/ChessGame';
import { SolanaGameManager, WalletState, GameRoom } from '@/lib/solana-integration';

type BotDifficulty = 'easy' | 'medium' | 'hard';

export default function Index() {
  const [solanaManager] = useState(() => new SolanaGameManager());
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });
  const [currentGame, setCurrentGame] = useState<GameRoom | null>(null);
  const [gameMode, setGameMode] = useState<'bot' | 'multiplayer' | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [activeTab, setActiveTab] = useState('play');

  // Auto-refresh wallet balance
  useEffect(() => {
    if (walletState.connected && walletState.publicKey) {
      const interval = setInterval(async () => {
        try {
          const { solana } = window as any;
          if (solana && solana.publicKey) {
            const balance = await solanaManager.getBalance(solana.publicKey);
            setWalletState(prev => ({ ...prev, balance }));
          }
        } catch (error) {
          console.error('Error refreshing balance:', error);
        }
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [walletState.connected, walletState.publicKey, solanaManager]);

  const handleWalletConnected = (newWalletState: WalletState) => {
    setWalletState(newWalletState);
    if (newWalletState.connected) {
      toast.success('Wallet connected! You can now play multiplayer games.');
    }
  };

  const handleGameStart = (gameRoom: GameRoom) => {
    setCurrentGame(gameRoom);
    setGameMode('multiplayer');
    setActiveTab('game');
  };

  const handleBotGame = (difficulty: BotDifficulty) => {
    setBotDifficulty(difficulty);
    setGameMode('bot');
    setCurrentGame(null);
    setActiveTab('game');
    toast.success(`Starting ${difficulty} bot game!`);
  };

  const handleGameEnd = (result: 'win' | 'lose' | 'draw', winner?: string) => {
    if (currentGame && gameMode === 'multiplayer') {
      // Update game status
      solanaManager.completeGame(currentGame.id, winner || 'draw');
    }
    
    setCurrentGame(null);
    setGameMode(null);
    setActiveTab('play');
    
    const messages = {
      win: '🎉 Congratulations! You won!',
      lose: '😔 Better luck next time!',
      draw: '🤝 Game ended in a draw!'
    };
    
    toast.success(messages[result]);
  };

  const handleBackToLobby = () => {
    setCurrentGame(null);
    setGameMode(null);
    setActiveTab('play');
  };

  const getDifficultyColor = (difficulty: BotDifficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-600';
      case 'medium': return 'bg-yellow-600';
      case 'hard': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (gameMode && activeTab === 'game') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2 sm:p-4">
        <div className="max-w-6xl mx-auto">
          {/* Game Header */}
          <div className="mb-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackToLobby}
                      className="shrink-0"
                    >
                      ← Back
                    </Button>
                    <div className="flex items-center gap-2">
                      {gameMode === 'bot' ? (
                        <>
                          <Bot className="h-5 w-5" />
                          <span className="font-medium">vs Bot</span>
                          <Badge className={getDifficultyColor(botDifficulty)}>
                            {botDifficulty}
                          </Badge>
                        </>
                      ) : (
                        <>
                          <Users className="h-5 w-5" />
                          <span className="font-medium">Multiplayer</span>
                          {currentGame && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {currentGame.entranceFee} SOL
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {walletState.connected && (
                    <div className="flex items-center gap-2 text-sm">
                      <Wallet className="h-4 w-4" />
                      <span className="font-mono">
                        {formatAddress(walletState.publicKey!)}
                      </span>
                      <Badge variant="outline">
                        {walletState.balance.toFixed(3)} SOL
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chess Game */}
          <ChessGame
            gameMode={gameMode}
            botDifficulty={botDifficulty}
            gameRoom={currentGame}
            walletState={walletState}
            onGameEnd={handleGameEnd}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Crown className="h-8 w-8 text-yellow-600" />
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Solana Chess
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Play chess with real Solana payments. Challenge bots for free or compete with players for SOL prizes.
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="play" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Play</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="play" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bot Games */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Play vs Bot (Free)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Practice your skills against AI opponents of different difficulty levels.
                  </p>
                  
                  <div className="space-y-3">
                    {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((difficulty) => (
                      <Button
                        key={difficulty}
                        variant="outline"
                        onClick={() => handleBotGame(difficulty)}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span className="capitalize">{difficulty} Bot</span>
                        </div>
                        <Badge className={getDifficultyColor(difficulty)}>
                          {difficulty === 'easy' ? 'Beginner' : difficulty === 'medium' ? 'Intermediate' : 'Expert'}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Multiplayer Games */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Multiplayer Games
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {walletState.connected ? (
                    <GameLobby
                      walletState={walletState}
                      solanaManager={solanaManager}
                      onGameStart={handleGameStart}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium mb-2">Connect Wallet Required</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect your Solana wallet to create or join multiplayer games
                      </p>
                      <Button onClick={() => setActiveTab('wallet')}>
                        Connect Wallet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <div className="max-w-md mx-auto">
              <WalletConnect
                onWalletConnected={handleWalletConnected}
                solanaManager={solanaManager}
              />
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Games Won</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Games Played</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <Coins className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">0.00</div>
                  <div className="text-sm text-muted-foreground">SOL Earned</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}