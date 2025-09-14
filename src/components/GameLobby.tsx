import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Plus, Users, Clock, Coins, Play } from 'lucide-react';
import { toast } from 'sonner';
import { SolanaGameManager, WalletState, GameRoom } from '@/lib/solana-integration';

interface GameLobbyProps {
  walletState: WalletState;
  solanaManager: SolanaGameManager;
  onGameStart: (gameRoom: GameRoom) => void;
}

export default function GameLobby({ walletState, solanaManager, onGameStart }: GameLobbyProps) {
  const [availableGames, setAvailableGames] = useState<GameRoom[]>([]);
  const [entranceFee, setEntranceFee] = useState('0.01');
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh available games every 5 seconds
  useEffect(() => {
    const refreshGames = async () => {
      try {
        const games = await solanaManager.getAvailableGames();
        setAvailableGames(games);
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };

    refreshGames();
    const interval = setInterval(refreshGames, 5000);
    return () => clearInterval(interval);
  }, [solanaManager]);

  // Check for game status changes (when someone joins your game)
  useEffect(() => {
    const checkGameStatus = async () => {
      try {
        const games = await solanaManager.getAvailableGames();
        const myGames = games.filter(game => 
          game.creator === walletState.publicKey && 
          game.status === 'active' && 
          game.opponent
        );

        // If we find a game that just got an opponent, start it
        if (myGames.length > 0) {
          const activeGame = myGames[0];
          toast.success(`Player joined your game! Starting match...`);
          
          // Small delay to show the toast
          setTimeout(() => {
            onGameStart(activeGame);
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking game status:', error);
      }
    };

    const interval = setInterval(checkGameStatus, 3000);
    return () => clearInterval(interval);
  }, [walletState.publicKey, solanaManager, onGameStart]);

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

    setIsCreatingGame(true);

    try {
      const gameRoom = await solanaManager.createGame(walletState.publicKey, fee);
      toast.success(`Game created! Waiting for opponent... (Fee: ${fee} SOL)`);
      
      // Refresh the games list
      const games = await solanaManager.getAvailableGames();
      setAvailableGames(games);
      
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Failed to create game. Please try again.');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleJoinGame = async (gameRoom: GameRoom) => {
    if (!walletState.connected || !walletState.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (gameRoom.entranceFee > walletState.balance) {
      toast.error('Insufficient balance to join this game');
      return;
    }

    if (gameRoom.creator === walletState.publicKey) {
      toast.error('You cannot join your own game');
      return;
    }

    setIsJoiningGame(gameRoom.id);

    try {
      const updatedGameRoom = await solanaManager.joinGame(gameRoom.id, walletState.publicKey);
      toast.success(`Joined game! Starting match...`);
      
      // Small delay to show the toast
      setTimeout(() => {
        onGameStart(updatedGameRoom);
      }, 1000);
      
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Failed to join game. It may have been taken by another player.');
      
      // Refresh games list in case the game was taken
      const games = await solanaManager.getAvailableGames();
      setAvailableGames(games);
    } finally {
      setIsJoiningGame(null);
    }
  };

  const handleRefreshGames = async () => {
    setIsRefreshing(true);
    try {
      const games = await solanaManager.getAvailableGames();
      setAvailableGames(games);
      toast.success('Games list refreshed');
    } catch (error) {
      console.error('Error refreshing games:', error);
      toast.error('Failed to refresh games');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  const myGames = availableGames.filter(game => game.creator === walletState.publicKey);
  const otherGames = availableGames.filter(game => 
    game.creator !== walletState.publicKey && 
    game.status === 'waiting'
  );

  return (
    <div className="space-y-6">
      {/* Create New Game */}
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
              max={walletState.balance}
              value={entranceFee}
              onChange={(e) => setEntranceFee(e.target.value)}
              placeholder="0.01"
            />
            <p className="text-xs text-muted-foreground">
              Your balance: {walletState.balance.toFixed(4)} SOL
            </p>
          </div>
          
          <Button 
            onClick={handleCreateGame} 
            disabled={isCreatingGame}
            className="w-full"
          >
            {isCreatingGame ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating Game...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Game
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* My Games */}
      {myGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                My Games
              </div>
              <Badge variant="secondary">{myGames.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myGames.map((game) => (
                <div key={game.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={game.status === 'waiting' ? 'secondary' : 'default'}>
                          {game.status === 'waiting' ? 'Waiting for opponent' : 'Active'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatTimeAgo(game.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          <span>{game.entranceFee} SOL</span>
                        </div>
                        {game.opponent && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>vs {formatAddress(game.opponent)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {game.status === 'active' && game.opponent && (
                      <Button 
                        size="sm" 
                        onClick={() => onGameStart(game)}
                        className="flex items-center gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Games
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{otherGames.length}</Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefreshGames}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {otherGames.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No games available</p>
              <p className="text-sm text-muted-foreground">
                Create a new game or wait for other players to create games
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherGames.map((game) => (
                <div key={game.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatAddress(game.creator)}
                        </span>
                        <Badge variant="secondary">Waiting</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatTimeAgo(game.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          <span>{game.entranceFee} SOL</span>
                        </div>
                        <div className="text-muted-foreground">
                          Winner gets: {(game.entranceFee * 1.8).toFixed(4)} SOL
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => handleJoinGame(game)}
                      disabled={isJoiningGame === game.id || game.entranceFee > walletState.balance}
                      size="sm"
                    >
                      {isJoiningGame === game.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Join ({game.entranceFee} SOL)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {availableGames.length === 0 && (
        <div className="text-center py-8">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Loading games...</p>
          <p className="text-sm text-muted-foreground">
            Fetching available games from the network
          </p>
        </div>
      )}
    </div>
  );
}