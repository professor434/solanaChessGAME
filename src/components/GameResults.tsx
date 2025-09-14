import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Coins, ExternalLink, Copy, RotateCcw } from 'lucide-react';
import { SolanaGameManager, GamePool, TREASURY_WALLET } from '@/lib/solana-integration';
import { PieceColor } from '@/lib/chess-logic';
import { toast } from 'sonner';

interface GameResultsProps {
  winner: PieceColor | null;
  gamePool: GamePool;
  playerWallet: string;
  solanaManager: SolanaGameManager;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameResults({ 
  winner, 
  gamePool, 
  playerWallet, 
  solanaManager,
  onPlayAgain,
  onBackToLobby 
}: GameResultsProps) {
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionComplete, setDistributionComplete] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const isWinner = winner !== null;
  const totalPrize = gamePool.totalAmount;
  const platformFee = totalPrize * 0.1;
  const winnerPrize = totalPrize * 0.9;

  useEffect(() => {
    if (winner && !distributionComplete) {
      distributePrizes();
    }
  }, [winner]);

  const distributePrizes = async () => {
    if (!winner) return;
    
    setIsDistributing(true);
    
    try {
      // Simulate winner wallet (in real implementation, this would come from game state)
      const winnerWallet = playerWallet; // Assuming current player is winner for demo
      
      const result = await solanaManager.distributePrize(gamePool, winnerWallet);
      
      if (result.success) {
        setTransactionHash(result.txHash || null);
        setDistributionComplete(true);
        toast.success('Prize distributed successfully!');
      } else {
        toast.error('Failed to distribute prize');
      }
    } catch (error) {
      console.error('Error distributing prizes:', error);
      toast.error('Error distributing prizes');
    } finally {
      setIsDistributing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const truncateHash = (hash: string): string => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Trophy className={`h-8 w-8 ${isWinner ? 'text-yellow-500' : 'text-gray-400'}`} />
          Game Results
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Winner Announcement */}
        <div className="text-center space-y-2">
          {winner ? (
            <>
              <div className="text-4xl mb-2">
                {winner === 'white' ? '♔' : '♚'}
              </div>
              <h2 className="text-2xl font-bold">
                {winner === 'white' ? 'White' : 'Black'} Wins!
              </h2>
              <Badge variant="default" className="text-lg px-4 py-2">
                Checkmate
              </Badge>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">🤝</div>
              <h2 className="text-2xl font-bold">Draw</h2>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Stalemate
              </Badge>
            </>
          )}
        </div>

        <Separator />

        {/* Prize Distribution */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Prize Distribution
          </h3>
          
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span>Total Prize Pool:</span>
              <Badge variant="outline" className="font-mono">
                {totalPrize.toFixed(4)} SOL
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Winner Prize (90%):</span>
              <Badge variant="default" className="font-mono">
                {winnerPrize.toFixed(4)} SOL
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Platform Fee (10%):</span>
              <Badge variant="secondary" className="font-mono">
                {platformFee.toFixed(4)} SOL
              </Badge>
            </div>
          </div>

          {/* Distribution Status */}
          {isDistributing && (
            <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-700">Distributing prizes...</span>
            </div>
          )}

          {distributionComplete && transactionHash && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                <Trophy className="h-4 w-4" />
                <span className="font-medium">Prizes distributed successfully!</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="text-sm font-medium">Transaction Hash:</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {truncateHash(transactionHash)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(transactionHash)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://explorer.solana.com/tx/${transactionHash}?cluster=devnet`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Treasury Information */}
        <div className="space-y-2">
          <h4 className="font-medium">Platform Treasury:</h4>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="font-mono text-sm">{TREASURY_WALLET.slice(0, 20)}...</div>
              <div className="text-xs text-muted-foreground">
                Received: {platformFee.toFixed(4)} SOL
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(TREASURY_WALLET)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://explorer.solana.com/address/${TREASURY_WALLET}?cluster=devnet`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={onPlayAgain}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Play Again
          </Button>
          
          <Button 
            onClick={onBackToLobby}
            variant="outline"
            className="flex-1"
          >
            Back to Lobby
          </Button>
        </div>

        {/* Game Statistics */}
        <div className="text-center text-sm text-muted-foreground">
          <div>Game ID: {gamePool.gameId}</div>
          <div>Players: {gamePool.players.length}/2</div>
        </div>
      </CardContent>
    </Card>
  );
}