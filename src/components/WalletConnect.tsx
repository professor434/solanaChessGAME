import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Copy, ExternalLink, RefreshCw, Coins, AlertCircle } from 'lucide-react';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);

  // Check for existing wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      const { solana } = window as any;
      if (solana && solana.isConnected) {
        const publicKey = solana.publicKey?.toString();
        if (publicKey) {
          const balance = await solanaManager.getBalance(solana.publicKey);
          const connectedState = {
            connected: true,
            publicKey,
            balance
          };
          setWalletState(connectedState);
          onWalletConnected(connectedState);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      const connected = await solanaManager.connectWallet();
      setWalletState(connected);
      onWalletConnected(connected);
      toast.success('Wallet connected successfully!');
      
      // Auto-redirect for mobile wallets
      if (window.innerWidth <= 768) {
        const currentUrl = window.location.href;
        setTimeout(() => {
          window.location.href = currentUrl;
        }, 1000);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      toast.error(error.message || 'Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { solana } = window as any;
      if (solana && solana.disconnect) {
        await solana.disconnect();
      }
      
      const disconnectedState = {
        connected: false,
        publicKey: null,
        balance: 0
      };
      setWalletState(disconnectedState);
      onWalletConnected(disconnectedState);
      toast.info('Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  const refreshBalance = async () => {
    if (!walletState.connected || !walletState.publicKey) return;
    
    setIsRefreshing(true);
    try {
      const { solana } = window as any;
      const balance = await solanaManager.getBalance(solana.publicKey);
      const updatedState = { ...walletState, balance };
      setWalletState(updatedState);
      onWalletConnected(updatedState);
      toast.success('Balance refreshed');
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast.error('Failed to refresh balance');
    } finally {
      setIsRefreshing(false);
    }
  };

  const requestAirdrop = async () => {
    if (!walletState.connected || !walletState.publicKey) return;
    
    setIsRequestingAirdrop(true);
    try {
      const { solana } = window as any;
      await solanaManager.requestAirdrop(solana.publicKey, 2);
      toast.success('Airdrop successful! Balance will update shortly.');
      
      // Refresh balance after airdrop
      setTimeout(() => {
        refreshBalance();
      }, 3000);
    } catch (error: any) {
      console.error('Error requesting airdrop:', error);
      toast.error(error.message || 'Failed to request airdrop');
    } finally {
      setIsRequestingAirdrop(false);
    }
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-green-600" />
            Wallet Connected
            <Badge variant="default" className="bg-green-600 text-xs">
              Devnet
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet Info */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-medium">Address:</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {truncateAddress(walletState.publicKey!)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(walletState.publicKey!)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-medium">Balance:</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  {walletState.balance.toFixed(4)} SOL
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshBalance}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Low Balance Warning */}
          {walletState.balance < 0.1 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Low Balance</div>
                <div className="text-xs mt-1">Request an airdrop to play games with entrance fees.</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={requestAirdrop}
              disabled={isRequestingAirdrop}
              className="flex-1"
            >
              {isRequestingAirdrop ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                'Request Airdrop (2 SOL)'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="flex-1"
            >
              Disconnect
            </Button>
          </div>

          {/* Treasury Info */}
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Treasury Wallet:</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {truncateAddress(TREASURY_WALLET)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(TREASURY_WALLET)}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://explorer.solana.com/address/${TREASURY_WALLET}?cluster=devnet`, '_blank')}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            Connected to Solana Devnet • Use test SOL only
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
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

        <div className="bg-blue-50 p-3 rounded-lg text-xs border border-blue-200">
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
              <RefreshCw className="h-4 w-4 animate-spin" />
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