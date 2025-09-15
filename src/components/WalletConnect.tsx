import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Copy, ExternalLink, RefreshCw, Coins, AlertCircle, ChevronDown, ExternalLinkIcon } from 'lucide-react';
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
  const [availableWallets, setAvailableWallets] = useState<any[]>([]);
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  // Check for existing wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
    loadAvailableWallets();
  }, []);

  const loadAvailableWallets = async () => {
    try {
      const wallets = await solanaManager.getAvailableWallets();
      setAvailableWallets(wallets);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const checkWalletConnection = async () => {
    try {
      // Check all possible wallet providers for existing connections
      const providers = [
        (window as any).phantom?.solana,
        (window as any).solflare,
        (window as any).backpack,
        (window as any).glow,
        (window as any).solana // Generic fallback
      ];

      for (const provider of providers) {
        if (provider && provider.isConnected) {
          const publicKey = provider.publicKey?.toString();
          if (publicKey) {
            const balance = await solanaManager.getBalance(provider.publicKey);
            const connectedState = {
              connected: true,
              publicKey,
              balance
            };
            setWalletState(connectedState);
            onWalletConnected(connectedState);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const handleConnectWallet = async (walletName?: string) => {
    setIsConnecting(true);
    try {
      const connected = await solanaManager.connectWallet(walletName);
      setWalletState(connected);
      onWalletConnected(connected);
      setShowWalletOptions(false);
      toast.success(`Wallet connected successfully!`);
      
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
      // Try to disconnect from all possible providers
      const providers = [
        (window as any).phantom?.solana,
        (window as any).solflare,
        (window as any).backpack,
        (window as any).glow,
        (window as any).solana
      ];

      for (const provider of providers) {
        if (provider && provider.disconnect) {
          try {
            await provider.disconnect();
          } catch (e) {
            // Ignore individual disconnect errors
          }
        }
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
      // Find the connected provider
      const providers = [
        (window as any).phantom?.solana,
        (window as any).solflare,
        (window as any).backpack,
        (window as any).glow,
        (window as any).solana
      ];

      let connectedProvider = null;
      for (const provider of providers) {
        if (provider && provider.isConnected && provider.publicKey) {
          connectedProvider = provider;
          break;
        }
      }

      if (connectedProvider) {
        const balance = await solanaManager.getBalance(connectedProvider.publicKey);
        const updatedState = { ...walletState, balance };
        setWalletState(updatedState);
        onWalletConnected(updatedState);
        toast.success('Balance refreshed');
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast.error('Failed to refresh balance');
    } finally {
      setIsRefreshing(false);
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
              Mainnet
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
          {walletState.balance < 0.01 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Low Balance</div>
                <div className="text-xs mt-1">You need SOL to play games with entrance fees. Purchase SOL from an exchange.</div>
              </div>
            </div>
          )}

          {/* Buy SOL Info */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
            <div className="font-medium text-blue-900 mb-2">💰 Need SOL?</div>
            <div className="text-blue-700 space-y-1 mb-2">
              <div>• Buy SOL on exchanges like Coinbase, Binance, or Kraken</div>
              <div>• Transfer to your wallet address above</div>
              <div>• Minimum 0.01 SOL recommended for game fees</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://coinbase.com/price/solana', '_blank')}
              className="text-blue-700 border-blue-300 hover:bg-blue-100"
            >
              <ExternalLinkIcon className="h-3 w-3 mr-1" />
              Buy SOL
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
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
                onClick={() => window.open(`https://explorer.solana.com/address/${TREASURY_WALLET}`, '_blank')}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            Connected to Solana Mainnet • Real SOL transactions
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
          
          {availableWallets.length > 0 && (
            <div className="text-xs text-green-600">
              ✓ {availableWallets.length} wallet(s) detected
            </div>
          )}
        </div>

        <div className="bg-red-50 p-3 rounded-lg text-xs border border-red-200">
          <div className="font-medium text-red-900 mb-1">⚠️ Mainnet Warning:</div>
          <div className="text-red-700 space-y-1">
            <div>• This uses REAL SOL on Solana mainnet</div>
            <div>• All transactions cost real money</div>
            <div>• Make sure you have SOL in your wallet</div>
            <div>• Start with small amounts for testing</div>
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

        {/* Wallet Selection */}
        {availableWallets.length > 1 ? (
          <div className="space-y-2">
            <Button 
              variant="outline"
              onClick={() => setShowWalletOptions(!showWalletOptions)}
              className="w-full justify-between"
            >
              Select Wallet ({availableWallets.length} available)
              <ChevronDown className={`h-4 w-4 transition-transform ${showWalletOptions ? 'rotate-180' : ''}`} />
            </Button>
            
            {showWalletOptions && (
              <div className="space-y-2 border rounded-lg p-2">
                {availableWallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    variant="ghost"
                    onClick={() => handleConnectWallet(wallet.name)}
                    disabled={isConnecting}
                    className="w-full justify-start"
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    {wallet.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button 
            onClick={() => handleConnectWallet()}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isConnecting ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Connecting...
              </div>
            ) : (
              `Connect ${availableWallets.length > 0 ? availableWallets[0].name : 'Wallet'}`
            )}
          </Button>
        )}

        <div className="text-xs text-center text-muted-foreground">
          Mainnet - Real SOL transactions
        </div>
      </CardContent>
    </Card>
  );
}
