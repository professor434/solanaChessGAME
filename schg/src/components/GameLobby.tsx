import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Coins, 
  Plus, 
  Trophy, 
  Clock, 
  User,
  Wallet,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { RealSolanaIntegration, GamePool } from '@/lib/real-wallet-integration';

interface GameLobbyProps {
  solanaIntegration: RealSolanaIntegration;
  onGameCreated: (gamePool: GamePool) => void;
  onGameJoined: (gamePool: GamePool) => void;
}

export default function GameLobby({ solanaIntegration, onGameCreated, onGameJoined }: GameLobbyProps) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [entranceFee, setEntranceFee] = useState('0.1');
  const [availableGames, setAvailableGames] = useState<GamePool[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch available games and balance on component mount and periodically
  useEffect(() => {
    if (connected && publicKey) {
      fetchAvailableGames();
      fetchBalance();
      
      // Set up periodic refresh
      const interval = setInterval(() => {
        fetchAvailableGames();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [connected, publicKey]);

  const fetchBalance = async () => {
    if (!publicKey) return;
    
    try {
      const bal = await solanaIntegration.getBalance(publicKey);
      setBalance(bal);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchAvailableGames = async () => {
    try {
      const games = solanaIntegration.getStoredGamePools();
      // Only show waiting games that aren't created by current user
      const waitingGames = games.filter(game => 
        game.status === 'waiting' && 
        game.createdBy !== publicKey?.toString() &&
        game.players.length < 2
      );
      setAvailableGames(waitingGames);
    } catch (error) {
      console.error('Error fetching games:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAvailableGames();
    await fetchBalance();
    setTimeout(() => setRefreshing(false), 1000);
    toast.success('Refreshed game list');
  };

  const handleCreateGame = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!sendTransaction) {
      toast.error('Wallet does not support transactions');
      return;
    }

    const fee = parseFloat(entranceFee);
    if (isNaN(fee) || fee < 0) {
      toast.error('Please enter a valid entrance fee');
      return;
    }

    if (fee > balance) {
      toast.error(`Insufficient balance. You have ${balance.toFixed(4)} SOL`);
      return;
    }

    if (fee > 10) {
      toast.error('Maximum entrance fee is 10 SOL');
      return;
    }

    setIsCreating(true);
    
    try {
      const gamePool = await solanaIntegration.createGamePool(
        { publicKey, connected, sendTransaction },
        fee
      );
      
      onGameCreated(gamePool);
      toast.success(`Game created with ${fee} SOL entrance fee!`);
      
      // Refresh balance after creating game
      await fetchBalance();
    } catch (error: any) {
      console.error('Error creating game:', error);
      toast.error(error.message || 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async (gamePool: GamePool) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!sendTransaction) {
      toast.error('Wallet does not support transactions');
      return;
    }

    if (gamePool.entranceFee > balance) {
      toast.error(`Insufficient balance. Required: ${gamePool.entranceFee} SOL, Available: ${balance.toFixed(4)} SOL`);
      return;
    }

    setIsJoining(gamePool.gameId);
    
    try {
      const updatedGamePool = await solanaIntegration.joinGamePool(
        { publicKey, connected, sendTransaction },
        gamePool
      );
      
      onGameJoined(updatedGamePool);
      toast.success(`Joined game with ${gamePool.entranceFee} SOL!`);
      
      // Refresh balance and games after joining
      await fetchBalance();
      await fetchAvailableGames();
    } catch (error: any) {
      console.error('Error joining game:', error);
      toast.error(error.message || 'Failed to join game');
    } finally {
      setIsJoining(null);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getNetworkInfo = () => {
    const info = solanaIntegration.getNetworkInfo();
    return info.network;
  };

  const formatAddress = (address: string | undefined): string => {
    if (!address || typeof address !== 'string') return 'Unknown';
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="space-y-6">
      {/* Wallet Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={connected ? "default" : "destructive"}>
                {connected ? "Connected" : "Disconnected"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {getNetworkInfo()}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              <span className="font-medium">{balance.toFixed(4)} SOL</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBalance}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            
            {publicKey && (
              <div className="text-xs text-muted-foreground font-mono">
                {formatAddress(publicKey.toString())}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Game */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entrance-fee">Entrance Fee (SOL)</Label>
              <Input
                id="entrance-fee"
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={entranceFee}
                onChange={(e) => setEntranceFee(e.target.value)}
                placeholder="0.1"
                disabled={isCreating}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 for free games. Maximum 10 SOL.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Prize Pool</Label>
              <div className="p-3 bg-muted rounded-md">
                <div className="text-lg font-semibold">
                  {(parseFloat(entranceFee) * 2 || 0).toFixed(4)} SOL
                </div>
                <div className="text-xs text-muted-foreground">
                  Winner gets 90% • Platform fee 10%
                </div>
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleCreateGame}
            disabled={!connected || isCreating || !sendTransaction}
            className="w-full"
          >
            {isCreating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating Game...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Game ({entranceFee} SOL)
              </>
            )}
          </Button>
          
          {!sendTransaction && connected && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>Your wallet doesn't support transactions. Please use a different wallet.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Games */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Games
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {availableGames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No games available</p>
              <p className="text-sm">Create a game or wait for others to create games</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableGames.map((game) => (
                <div key={game.gameId} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4" />
                        <span className="font-medium">
                          {formatAddress(game.createdBy)}
                        </span>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeAgo(game.createdAt)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          <span>Entrance: {game.entranceFee} SOL</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          <span>Prize: {(game.entranceFee * 2).toFixed(4)} SOL</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleJoinGame(game)}
                      disabled={!connected || isJoining === game.gameId || !sendTransaction || game.entranceFee > balance}
                      className="min-w-[100px]"
                    >
                      {isJoining === game.gameId ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-2" />
                          Join Game
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {game.entranceFee > balance && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                      Insufficient balance. Required: {game.entranceFee} SOL, Available: {balance.toFixed(4)} SOL
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Game Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>• Both players pay the entrance fee to join a game</div>
          <div>• Winner takes 90% of the total prize pool</div>
          <div>• Platform keeps 10% as service fee</div>
          <div>• Games expire after 1 hour if no opponent joins</div>
          <div>• Each player gets 10 minutes on their chess clock</div>
          <div>• Standard chess rules apply with checkmate, stalemate, and draw conditions</div>
        </CardContent>
      </Card>
    </div>
  );
}