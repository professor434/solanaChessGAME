import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Copy, ExternalLink, RefreshCw, Coins, AlertCircle, Download, Smartphone } from 'lucide-react';
import { SolanaGameManager, WalletState, TREASURY_WALLET } from '@/lib/solana-integration';
import { toast } from 'sonner';

interface WalletConnectProps {
  onWalletConnected: (walletState: WalletState) => void;
  solanaManager: SolanaGameManager;
}

interface WalletOption {
  name: string;
  icon: string;
  url: string;
  readyState: 'Installed' | 'NotDetected';
  provider?: any;
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
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletOption[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Check for existing wallet connection on mount
  useEffect(() => {
    // Detect mobile
    const mobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
    
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
      // Check all possible wallet providers (mobile and desktop)
      const win = window as any;
      const providers = [
        win.phantom?.solana,
        win.solflare,
        win.backpack,
        win.glow,
        win.solana // Generic mobile provider
      ];

      for (const provider of providers) {
        if (provider && (provider.isConnected || provider.connected)) {
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
      setShowWalletSelector(false);
      toast.success(`${walletName || 'Wallet'} connected successfully!`);
      
      // Mobile wallet redirect
      if (isMobile) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      if (error.message === 'MULTIPLE_WALLETS_AVAILABLE') {
        setShowWalletSelector(true);
      } else {
        toast.error(error.message || 'Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWalletSelection = (walletName: string) => {
    const wallet = availableWallets.find(w => w.name === walletName);
    
    if (wallet?.readyState === 'NotDetected') {
      if (isMobile) {
        // Mobile deep links
        const deepLinks = {
          'Phantom': 'https://phantom.app/ul/browse/' + encodeURIComponent(window.location.href),
          'Solflare': 'https://solflare.com/ul/browse/' + encodeURIComponent(window.location.href),
          'Backpack': wallet.url,
          'Glow': wallet.url
        };
        
        const deepLink = deepLinks[walletName as keyof typeof deepLinks] || wallet.url;
        window.open(deepLink, '_blank');
        toast.info(`Opening ${walletName} wallet app...`);
      } else {
        // Desktop - open download page
        window.open(wallet.url, '_blank');
        toast.info(`Please install ${walletName} wallet and refresh the page.`);
      }
      return;
    }
    
    handleConnectWallet(walletName);
  };

  const handleDisconnect = async () => {
    try {
      // Try to disconnect from all possible providers
      const win = window as any;
      const providers = [
        win.phantom?.solana,
        win.solflare,
        win.backpack,
        win.glow,
        win.solana
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
      const win = window as any;
      const providers = [
        win.phantom?.solana,
        win.solflare,
        win.backpack,
        win.glow,
        win.solana
      ];

      let connectedProvider = null;
      for (const provider of providers) {
        if (provider && (provider.isConnected || provider.connected) && provider.publicKey) {
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

  const requestAirdrop = async () => {
    if (!walletState.connected || !walletState.publicKey) return;
    
    setIsRequestingAirdrop(true);
    try {
      // Find the connected provider
      const win = window as any;
      const providers = [
        win.phantom?.solana,
        win.solflare,
        win.backpack,
        win.glow,
        win.solana
      ];

      let connectedProvider = null;
      for (const provider of providers) {
        if (provider && (provider.isConnected || provider.connected) && provider.publicKey) {
          connectedProvider = provider;
          break;
        }
      }

      if (connectedProvider) {
        await solanaManager.requestAirdrop(connectedProvider.publicKey, 2);
        toast.success('Airdrop successful! Balance will update shortly.');
        
        // Refresh balance after airdrop
        setTimeout(() => {
          refreshBalance();
        }, 3000);
      }
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
            {isMobile && <Smartphone className="h-4 w-4 text-blue-600" />}
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
            Connected to Solana Devnet {isMobile ? '• Mobile' : '• Desktop'} • Use test SOL only
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Connect Solana Wallet
            {isMobile && <Smartphone className="h-4 w-4 text-blue-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Connect your Solana wallet to play chess and make payments with SOL.
            {isMobile && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
                📱 <strong>Mobile Users:</strong> Make sure you have Phantom or Solflare app installed, then open this game inside the wallet's browser.
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="text-xs font-medium">
              {availableWallets.filter(w => w.readyState === 'Installed').length > 0 ? 'Detected Wallets:' : 'Supported Wallets:'}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableWallets.map((wallet) => (
                <Badge 
                  key={wallet.name}
                  variant={wallet.readyState === 'Installed' ? 'default' : 'outline'}
                  className={wallet.readyState === 'Installed' ? 'bg-green-600' : ''}
                >
                  {wallet.name}
                  {wallet.readyState === 'Installed' && ' ✓'}
                </Badge>
              ))}
            </div>
          </div>

          {isMobile && availableWallets.filter(w => w.readyState === 'Installed').length === 0 && (
            <div className="bg-orange-50 p-3 rounded-lg text-xs border border-orange-200">
              <div className="font-medium text-orange-900 mb-1">📱 Mobile Setup Required:</div>
              <div className="text-orange-700 space-y-1">
                <div>1. Install Phantom or Solflare mobile app</div>
                <div>2. Open the app and create/import wallet</div>
                <div>3. Use the in-app browser to visit this game</div>
                <div>4. The wallet should be detected automatically</div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-lg text-xs border border-blue-200">
            <div className="font-medium text-blue-900 mb-1">Game Economics:</div>
            <div className="text-blue-700 space-y-1">
              <div>• Pay entrance fee in SOL to join games</div>
              <div>• Winner gets 90% of the prize pool</div>
              <div>• 10% platform fee goes to treasury</div>
            </div>
          </div>

          <Button 
            onClick={() => {
              const installedWallets = availableWallets.filter(w => w.readyState === 'Installed');
              if (installedWallets.length === 1) {
                handleConnectWallet(installedWallets[0].name);
              } else if (installedWallets.length > 1) {
                setShowWalletSelector(true);
              } else {
                setShowWalletSelector(true);
              }
            }}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isConnecting ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Connecting...
              </div>
            ) : (
              availableWallets.filter(w => w.readyState === 'Installed').length === 1 ? 
              `Connect ${availableWallets.find(w => w.readyState === 'Installed')?.name}` :
              'Select Wallet'
            )}
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            This demo uses Solana Devnet for testing
          </div>
        </CardContent>
      </Card>

      {/* Wallet Selection Dialog */}
      <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Select Wallet
              {isMobile && <Smartphone className="h-4 w-4 text-blue-600" />}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {availableWallets.map((wallet) => (
              <Button
                key={wallet.name}
                variant="outline"
                className="w-full justify-between h-auto p-4"
                onClick={() => handleWalletSelection(wallet.name)}
                disabled={isConnecting}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{wallet.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {wallet.readyState === 'Installed' ? 'Ready to connect' : 
                       isMobile ? 'Open in app' : 'Not installed'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wallet.readyState === 'Installed' ? (
                    <Badge variant="default" className="bg-green-600 text-xs">
                      Installed
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      {isMobile ? <Smartphone className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                      <span className="text-xs">{isMobile ? 'Open' : 'Install'}</span>
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
          
          <div className="text-xs text-center text-muted-foreground mt-4">
            {isMobile ? 
              'On mobile, wallets work best when accessed through their own app browsers.' :
              'Don\'t have a wallet? Click on any wallet above to install it.'
            }
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
