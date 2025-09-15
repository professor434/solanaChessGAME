import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GamepadIcon, Users, Clock, Coins, Trophy, TrendingUp, RefreshCw, Plus } from 'lucide-react';
import { SolanaGameManager, GameRoom, WalletState, GameStats } from '@/lib/solana-integration';
import { toast } from 'sonner';

interface GameLobbyProps {
  walletState: WalletState;
  solanaManager: SolanaGameManager;
  onStartGame: (gameRoom: GameRoom) => void;
}

export default function GameLobby({ walletState, solanaManager, onStartGame }: GameLobbyProps) {
  const [availableGames, setAvailableGames] = useState<GameRoom[]>([]);
  const [entranceFee, setEntranceFee] = useState(0.01);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playerStats, setPlayerStats] = useState<GameStats | null>(null);

  useEffect(() => {
    if (walletState.connected && walletState.publicKey) {
      loadAvailableGames();
      loadPlayerStats();
      
      // Auto-refresh games every 10 seconds
      const interval = setInterval(loadAvailableGames, 10000);
      return () => clearInterval(interval);
    }
  }, [walletState.connected, walletState.publicKey]);

  const loadAvailableGames = async () => {
    try {
      const games = await solanaManager.getAvailableGames();
      setAvailableGames(games);
    } catch (error) {
      console.error('Error loading games:', error);
      toast.error('Failed to load available games');
    }
  };

  const loadPlayerStats = async () => {
    if (!walletState.publicKey) return;
    
    try {
      const stats = solanaManager.getPlayerStats(walletState.publicKey);
      setPlayerStats(stats);
    } catch (error) {
      console.error('Error loading player stats:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAvailableGames();
      await loadPlayerStats();
      toast.success('Games refreshed');
    } catch (error) {
      toast.error('Failed to refresh games');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateGame = async () => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (walletState.balance < entranceFee) {
      toast.error(`Insufficient balance. You need at least ${entranceFee} SOL to create this game.`);
      return;
    }

    setIsCreatingGame(true);
    try {
      const gameRoom = await solanaManager.createGame(walletState.publicKey, entranceFee);
      toast.success(`Game created! Entrance fee of ${entranceFee} SOL paid.`);
      await loadAvailableGames();
      await loadPlayerStats();
      onStartGame(gameRoom);
    } catch (error: any) {
      console.error('Error creating game:', error);
      toast.error(error.message || 'Failed to create game');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleJoinGame = async (gameRoom: GameRoom) => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (gameRoom.creator === walletState.publicKey) {
      toast.error('You cannot join your own game');
      return;
    }

    if (walletState.balance < gameRoom.entranceFee) {
      toast.error(`Insufficient balance. You need at least ${gameRoom.entranceFee} SOL to join this game.`);
      return;
    }

    setIsJoiningGame(gameRoom.id);
    try {
      const joinedGame = await solanaManager.joinGame(gameRoom.id, walletState.publicKey);
      toast.success(`Joined game! Entrance fee of ${gameRoom.entranceFee} SOL paid.`);
      await loadAvailableGames();
      await loadPlayerStats();
      onStartGame(joinedGame);
    } catch (error: any) {
      console.error('Error joining game:', error);
      toast.error(error.message || 'Failed to join game');
    } finally {
      setIsJoiningGame(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!walletState.connected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GamepadIcon className="h-5 w-5" />
            Game Lobby
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Please connect your wallet to access the game lobby.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Player Stats */}
      {playerStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{playerStats.totalGames}</div>
                <div className="text-xs text-muted-foreground">Total Games</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{playerStats.wins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{playerStats.losses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{playerStats.draws}</div>
                <div className="text-xs text-muted-foreground">Draws</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {playerStats.totalEarnings.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">Earned (SOL)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {playerStats.totalSpent.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">Spent (SOL)</div>
              </div>
            </div>
            
            {playerStats.totalGames > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Win Rate: {((playerStats.wins / playerStats.totalGames) * 100).toFixed(1)}%
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Net: {(playerStats.totalEarnings - playerStats.totalSpent).toFixed(3)} SOL
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Game */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Game
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
              max="10"
              value={entranceFee}
              onChange={(e) => setEntranceFee(parseFloat(e.target.value) || 0.001)}
              placeholder="0.01"
            />
            <div className="text-xs text-muted-foreground">
              Winner gets 90% of prize pool ({(entranceFee * 2 * 0.9).toFixed(3)} SOL), 10% goes to platform
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
            <div className="font-medium text-blue-900 mb-1">⚡ Real Payment Required</div>
            <div className="text-blue-700 space-y-1">
              <div>• Your entrance fee will be charged immediately</div>
              <div>• Opponent pays when joining your game</div>
              <div>• Winner receives payout automatically</div>
            </div>
          </div>

          <Button 
            onClick={handleCreateGame}
            disabled={isCreatingGame || walletState.balance < entranceFee}
            className="w-full"
          >
            {isCreatingGame ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating Game & Processing Payment...
              </>
            ) : (
              `Create Game (Pay ${entranceFee} SOL)`
            )}
          </Button>
          
          {walletState.balance < entranceFee && (
            <div className="text-xs text-red-600 text-center">
              Insufficient balance. You have {walletState.balance.toFixed(4)} SOL, need {entranceFee} SOL
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Games ({availableGames.length})
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableGames.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <GamepadIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-lg font-medium mb-2">No games available</div>
              <div className="text-sm">Create a new game to get started!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {availableGames.map((game) => (
                <div key={game.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {formatAddress(game.creator)}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {game.entranceFee} SOL
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(game.createdAt)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        Prize Pool: {(game.entranceFee * 2).toFixed(3)} SOL • Winner gets: {(game.entranceFee * 2 * 0.9).toFixed(3)} SOL
                      </div>
                      
                      {game.creator === walletState.publicKey && (
                        <Badge variant="default" className="bg-blue-600">
                          Your Game
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {game.creator === walletState.publicKey ? (
                        <Badge variant="outline">Waiting for opponent...</Badge>
                      ) : (
                        <Button
                          onClick={() => handleJoinGame(game)}
                          disabled={isJoiningGame === game.id || walletState.balance < game.entranceFee}
                          size="sm"
                        >
                          {isJoiningGame === game.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            `Join (${game.entranceFee} SOL)`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 Payment & Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="font-medium text-green-700 mb-2">✅ How Payments Work:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Creator pays entrance fee when creating game</li>
                <li>• Opponent pays entrance fee when joining</li>
                <li>• Winner gets 90% of total prize pool</li>
                <li>• 10% platform fee goes to treasury</li>
                <li>• All payments are processed on Solana blockchain</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-blue-700 mb-2">🎮 Game Rules:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Standard chess rules apply</li>
                <li>• White moves first</li>
                <li>• Checkmate or resignation wins</li>
                <li>• Stalemate results in draw (fees returned)</li>
                <li>• Stats are tracked automatically</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
