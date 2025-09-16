import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Wallet, Plus, Users, Crown, TrendingUp, Trophy, Gamepad2, Bot, Zap, Target, Brain, Medal, Star, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import WalletConnect from '@/components/WalletConnect';
import ChessGame from '@/components/ChessGame';
import RankingDisplay from '@/components/RankingDisplay';
import { SolanaGameManager, WalletState, GameRoom } from '@/lib/solana-integration';
import { rankingSystem, PlayerRank } from '@/lib/ranking-system';

export default function Index() {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });
  
  const [solanaManager] = useState(() => new SolanaGameManager());
  const [availableGames, setAvailableGames] = useState<GameRoom[]>([]);
  const [currentGame, setCurrentGame] = useState<GameRoom | null>(null);
  const [entranceFee, setEntranceFee] = useState('0.001');
  const [isLoading, setIsLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'bot'>('multiplayer');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [playerRank, setPlayerRank] = useState<PlayerRank | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    window.innerWidth <= 768;
      setIsMobile(mobile);
      console.log(`📱 Device detection: ${mobile ? 'Mobile' : 'Desktop'}`);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load available games with mobile compatibility
  useEffect(() => {
    if (!walletState.connected) {
      setAvailableGames([]);
      return;
    }

    const loadGames = async () => {
      try {
        let games;
        if (isMobile) {
          games = await solanaManager.refreshGamesForMobile();
        } else {
          games = await solanaManager.getAvailableGames();
        }
        setAvailableGames(games || []);
      } catch (error) {
        console.error('Error loading games:', error);
        setAvailableGames([]);
      }
    };

    loadGames();
    const interval = setInterval(loadGames, isMobile ? 15000 : 10000); // Longer interval on mobile
    return () => clearInterval(interval);
  }, [solanaManager, walletState.connected, isMobile]);

  // Load player rank when wallet connected
  useEffect(() => {
    if (walletState.connected && walletState.publicKey) {
      const rank = rankingSystem.getPlayerRank(walletState.publicKey);
      setPlayerRank(rank);
    } else {
      setPlayerRank(null);
    }
  }, [walletState]);

  const handleWalletConnected = (newWalletState: WalletState) => {
    setWalletState(newWalletState);
    if (newWalletState.connected) {
      toast.success('Wallet connected successfully!');
      
      // Initialize tournament if needed
      const tournament = rankingSystem.getCurrentTournament();
      if (!tournament) {
        rankingSystem.initializeAnnualTournament();
      }
    }
  };

  const handleCreateGame = async () => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    const fee = parseFloat(entranceFee);
    if (isNaN(fee) || fee <= 0) {
      toast.error('Please enter a valid entrance fee');
      return;
    }

    if (fee > walletState.balance) {
      toast.error('Insufficient balance');
      return;
    }

    setIsLoading(true);
    try {
      toast.info('Creating game and processing payment...', { duration: 3000 });
      
      const gameRoom = await solanaManager.createGameWithWallet(walletState.publicKey, fee);
      
      // Verify the game is properly signed
      const isSigned = solanaManager.isGameFullySigned(gameRoom.id);
      if (!isSigned) {
        throw new Error('Game contract not properly signed');
      }
      
      setCurrentGame(gameRoom);
      setGameMode('multiplayer');
      toast.success('🎮 Game created and contract signed! Waiting for opponent...');
    } catch (error: any) {
      console.error('Error creating game:', error);
      toast.error(error.message || 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      toast.info('Joining game and processing payment...', { duration: 3000 });
      
      const gameRoom = await solanaManager.joinGame(gameId, walletState.publicKey);
      
      // Verify both players have signed
      const isSigned = solanaManager.isGameFullySigned(gameRoom.id);
      if (!isSigned) {
        throw new Error('Game contracts not fully signed');
      }
      
      setCurrentGame(gameRoom);
      setGameMode('multiplayer');
      toast.success('🎮 Joined game and contract signed! Game starting...');
    } catch (error: any) {
      console.error('Error joining game:', error);
      toast.error(error.message || 'Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBotGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setBotDifficulty(difficulty);
    setGameMode('bot');
    // Create a dummy game room for bot games
    setCurrentGame({
      id: `bot_${Date.now()}`,
      creator: walletState.publicKey,
      opponent: 'bot',
      entranceFee: 0,
      status: 'active',
      winner: null,
      createdAt: Date.now(),
      creatorSigned: true,
      opponentSigned: true
    });
    toast.success(`Starting ${difficulty} bot game!`);
  };

  const handleGameEnd = (result?: { winner: 'white' | 'black' | 'draw'; playerColor: 'white' | 'black' }) => {
    // Update ranking if it was a bot game
    if (currentGame?.opponent === 'bot' && walletState.publicKey && result) {
      const gameResult = result.winner === 'draw' ? 'draw' : 
                        (result.winner === result.playerColor ? 'win' : 'loss');
      
      const { player, newAchievements, rankUp } = rankingSystem.updatePlayerAfterGame(
        walletState.publicKey,
        gameResult,
        1000, // Bot ELO
        0, // No earnings from bot games
        0  // No spending on bot games
      );
      
      setPlayerRank(player);
      
      // Show achievement notifications
      if (newAchievements.length > 0) {
        newAchievements.forEach(achievementId => {
          const achievement = rankingSystem.getAchievementInfo(achievementId);
          if (achievement) {
            toast.success(`🏆 Achievement Unlocked: ${achievement.name}!`);
          }
        });
      }
      
      // Show rank up notification
      if (rankUp) {
        toast.success(`🎉 Rank Up! You are now ${player.currentRank}!`);
      }
    } else if (currentGame?.opponent !== 'bot' && currentGame) {
      // Complete multiplayer game
      if (result && walletState.publicKey) {
        const winner = result.winner === result.playerColor ? walletState.publicKey : 
                      (currentGame.creator === walletState.publicKey ? currentGame.opponent! : currentGame.creator);
        
        if (result.winner !== 'draw') {
          solanaManager.completeGame(currentGame.id, winner);
          toast.success('🎉 Game completed! Winnings processed.');
        }
      }
    }
    
    setCurrentGame(null);
    setGameMode('multiplayer');
  };

  const handleRefreshGames = async () => {
    if (!walletState.connected) return;
    
    setIsLoading(true);
    try {
      let games;
      if (isMobile) {
        games = await solanaManager.refreshGamesForMobile();
      } else {
        games = await solanaManager.getAvailableGames();
      }
      setAvailableGames(games || []);
      toast.success('Games refreshed!');
    } catch (error) {
      console.error('Error refreshing games:', error);
      toast.error('Failed to refresh games');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getPlayerStats = () => {
    if (!walletState.publicKey) return null;
    return solanaManager.getPlayerStats(walletState.publicKey);
  };

  // If in a game, show the chess game
  if (currentGame) {
    return (
      <ChessGame
        gameMode={gameMode}
        gameRoom={gameMode === 'multiplayer' ? currentGame : null}
        botDifficulty={botDifficulty}
        walletState={walletState}
        onGameEnd={handleGameEnd}
      />
    );
  }

  // If showing rankings, show ranking display
  if (showRankings && walletState.publicKey) {
    return (
      <RankingDisplay
        playerPublicKey={walletState.publicKey}
        onClose={() => setShowRankings(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Solana Chess
            </h1>
            {isMobile && (
              <div className="p-2 bg-green-100 rounded-full">
                <Smartphone className="h-6 w-6 text-green-600" />
              </div>
            )}
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Play chess with real SOL stakes or practice against AI bots! {isMobile ? 'Mobile optimized!' : 'Climb the ranks and win annual tournaments!'}
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="max-w-md mx-auto mb-8">
          <WalletConnect 
            onWalletConnected={handleWalletConnected} 
            solanaManager={solanaManager}
          />
        </div>

        {walletState.connected && (
          <>
            {/* Player Rank & Stats */}
            <div className="max-w-4xl mx-auto mb-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Your Profile
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRankings(true)}
                      >
                        <Medal className="h-4 w-4 mr-1" />
                        Rankings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowStats(!showStats)}
                      >
                        {showStats ? 'Hide' : 'Show'} Details
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Rank Display */}
                  {playerRank && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: rankingSystem.getRankColor(playerRank.currentRank) }}
                          >
                            {playerRank.currentRank === 'Pawn' ? '♟️' : 
                             playerRank.currentRank === 'Knight' ? '♞' : 
                             playerRank.currentRank === 'Bishop' ? '♝' : 
                             playerRank.currentRank === 'Rook' ? '♜' : 
                             playerRank.currentRank === 'Queen' ? '♛' : 
                             playerRank.currentRank === 'King' ? '♚' : 
                             playerRank.currentRank === 'Grandmaster' ? '👑' : '⭐'}
                          </div>
                          <div>
                            <div className="font-bold text-lg" style={{ color: rankingSystem.getRankColor(playerRank.currentRank) }}>
                              {playerRank.currentRank}
                            </div>
                            <div className="text-sm text-gray-600">{playerRank.elo} ELO</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Win Streak</div>
                          <div className="font-bold text-lg text-orange-600">{playerRank.winStreak}</div>
                        </div>
                      </div>
                      
                      {/* Achievements Preview */}
                      {playerRank.achievements.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {playerRank.achievements.slice(0, 5).map((achievementId) => {
                            const achievement = rankingSystem.getAchievementInfo(achievementId);
                            return achievement ? (
                              <Badge key={achievementId} variant="secondary" className="text-xs">
                                {achievement.icon} {achievement.name}
                              </Badge>
                            ) : null;
                          })}
                          {playerRank.achievements.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{playerRank.achievements.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {showStats && (
                    <>
                      {(() => {
                        const stats = getPlayerStats();
                        if (!stats) return <p className="text-gray-500">No stats available</p>;
                        
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
                              <div className="text-sm text-gray-600">Games Played</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
                              <div className="text-sm text-gray-600">Wins</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
                              <div className="text-sm text-gray-600">Losses</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-purple-600">{stats.totalEarnings.toFixed(4)} SOL</div>
                              <div className="text-sm text-gray-600">Total Earnings</div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bot Games Section */}
            <div className="max-w-4xl mx-auto mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Practice Against AI (Free - Counts Towards Ranking!)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Easy Bot */}
                    <div className="border rounded-lg p-4 text-center hover:bg-green-50 transition-colors">
                      <div className="flex items-center justify-center mb-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Zap className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Easy Bot</h3>
                      <p className="text-sm text-gray-600 mb-4">Random moves, perfect for beginners</p>
                      <Button
                        onClick={() => handleStartBotGame('easy')}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Play Easy
                      </Button>
                    </div>

                    {/* Medium Bot */}
                    <div className="border rounded-lg p-4 text-center hover:bg-yellow-50 transition-colors">
                      <div className="flex items-center justify-center mb-3">
                        <div className="p-2 bg-yellow-100 rounded-full">
                          <Target className="h-6 w-6 text-yellow-600" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Medium Bot</h3>
                      <p className="text-sm text-gray-600 mb-4">Prefers captures, good for practice</p>
                      <Button
                        onClick={() => handleStartBotGame('medium')}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        Play Medium
                      </Button>
                    </div>

                    {/* Hard Bot */}
                    <div className="border rounded-lg p-4 text-center hover:bg-red-50 transition-colors">
                      <div className="flex items-center justify-center mb-3">
                        <div className="p-2 bg-red-100 rounded-full">
                          <Brain className="h-6 w-6 text-red-600" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Hard Bot</h3>
                      <p className="text-sm text-gray-600 mb-4">Strategic play, challenging opponent</p>
                      <Button
                        onClick={() => handleStartBotGame('hard')}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        Play Hard
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 text-center text-sm text-gray-500">
                    🏆 Bot games count towards your ELO rating and achievements!
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create Game */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create New Game (Real SOL Stakes)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entrance-fee">Entrance Fee (SOL)</Label>
                    <Input
                      id="entrance-fee"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={entranceFee}
                      onChange={(e) => setEntranceFee(e.target.value)}
                      placeholder="0.001"
                    />
                    <p className="text-xs text-gray-500">
                      Your balance: {walletState.balance.toFixed(4)} SOL
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Prize Pool:</span>
                      <span className="font-medium">{(parseFloat(entranceFee || '0') * 2).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Winner Gets:</span>
                      <span className="font-medium text-green-600">{(parseFloat(entranceFee || '0') * 1.8).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Platform Fee:</span>
                      <span className="font-medium text-gray-500">{(parseFloat(entranceFee || '0') * 0.2).toFixed(4)} SOL</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-blue-800">
                      🔐 <strong>Secure Escrow:</strong> Your SOL is held in escrow until game completion
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateGame}
                    disabled={isLoading || !entranceFee || parseFloat(entranceFee) <= 0}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isLoading ? 'Creating & Signing...' : 'Create & Sign Game'}
                  </Button>
                </CardContent>
              </Card>

              {/* Available Games */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Available Games ({availableGames.length})
                      {isMobile && <Badge variant="secondary">Mobile</Badge>}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshGames}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {availableGames.length === 0 ? (
                      <div className="text-center py-8">
                        <Gamepad2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">No games available</p>
                        <p className="text-sm text-gray-400">Create the first game!</p>
                      </div>
                    ) : (
                      availableGames.map((game) => (
                        <div key={game.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium">{game.entranceFee} SOL</span>
                              {(game as any).creatorSigned && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  ✓ Signed
                                </Badge>
                              )}
                            </div>
                            <Badge variant="secondary">
                              Prize: {(game.entranceFee * 1.8).toFixed(4)} SOL
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Created by: {formatAddress(game.creator)}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleJoinGame(game.id)}
                              disabled={isLoading || game.creator === walletState.publicKey}
                            >
                              {game.creator === walletState.publicKey ? 'Your Game' : 'Join & Sign'}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Powered by Solana • {walletState.connected ? 'Secure escrow contracts with real SOL stakes' : 'Real SOL transactions on mainnet'}</p>
          {isMobile && <p className="mt-1">📱 Mobile optimized for iOS and Android</p>}
        </div>
      </div>
    </div>
  );
}
