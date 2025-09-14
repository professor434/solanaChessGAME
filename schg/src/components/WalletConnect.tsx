import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Copy, ExternalLink } from 'lucide-react';
import { SolanaGameManager, WalletState, TREASURY_WALLET } from '@/lib/solana-integration';
import { toast } from 'sonner';

interface WalletConnectProps {
  onWalletConnected: (walletState: WalletState) => void;
  solanaManager: SolanaGameManager;
}

export default function WalletConnect({ onWalletConnected, solanaManager }: WalletConnectProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      const connected = await solanaManager.connectWallet();
      setWalletState(connected);
      onWalletConnected(connected);
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWalletState({
      connected: false,
      publicKey: null,
      balance: 0
    });
    toast.info('Wallet disconnected');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (walletState.connected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Address:</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {truncateAddress(walletState.publicKey!)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(walletState.publicKey!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Balance:</span>
              <Badge variant="secondary">
                {walletState.balance.toFixed(4)} SOL
              </Badge>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Treasury Wallet:</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {truncateAddress(TREASURY_WALLET)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(TREASURY_WALLET)}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://explorer.solana.com/address/${TREASURY_WALLET}?cluster=devnet`, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={handleDisconnect}
            className="w-full"
          >
            Disconnect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Solana Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Connect your Solana wallet to play chess and make payments with SOL.
        </div>
        
        <div className="space-y-2">
          <div className="text-xs font-medium">Supported Wallets:</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Phantom</Badge>
            <Badge variant="outline">Solflare</Badge>
            <Badge variant="outline">Backpack</Badge>
            <Badge variant="outline">Glow</Badge>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-xs">
          <div className="font-medium text-blue-900 mb-1">Game Economics:</div>
          <div className="text-blue-700 space-y-1">
            <div>• Pay entrance fee in SOL to join games</div>
            <div>• Winner gets 90% of the prize pool</div>
            <div>• 10% platform fee goes to treasury</div>
          </div>
        </div>

        <Button 
          onClick={handleConnectWallet}
          disabled={isConnecting}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isConnecting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </div>
          ) : (
            'Connect Wallet'
          )}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          This demo uses Solana Devnet for testing
        </div>
      </CardContent>
    </Card>
  );
}