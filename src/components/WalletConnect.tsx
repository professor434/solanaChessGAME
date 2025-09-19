import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Search, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { walletManager, WalletInfo, ConnectedWallet } from '@/lib/wallet-manager';
import { SolanaGameManager, WalletState } from '@/lib/solana-integration';

interface WalletConnectProps {
  onWalletConnected: (walletState: WalletState) => void;
  solanaManager: SolanaGameManager;
}

export default function WalletConnect({ onWalletConnected, solanaManager }: WalletConnectProps) {
  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);
  const [allWallets, setAllWallets] = useState<WalletInfo[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [autoReconnectAttempted, setAutoReconnectAttempted] = useState(false);
  const [isDetectingWallets, setIsDetectingWallets] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Initialize wallets
    const updateWallets = () => {
      const available = walletManager.getAvailableWallets();
      const all = walletManager.getAllWallets();
      
      setAvailableWallets(available);
      setAllWallets(all);
      
      console.log(`🔍 UI Updated: ${available.length} available wallets`);
    };

    updateWallets();

    // Check for existing connection
    const existing = walletManager.getConnectedWallet();
    if (existing) {
      setConnectedWallet(existing);
      handleWalletConnected(existing);
    }

    // Listen for wallet updates
    const handleWalletsUpdated = () => {
      console.log('🔄 Wallets updated event received');
      updateWallets();
    };

    // Listen for auto-reconnection events
    const handleAutoReconnect = (event: CustomEvent) => {
      const wallet = event.detail as ConnectedWallet;
      setConnectedWallet(wallet);
      handleWalletConnected(wallet);
      setAutoReconnectAttempted(true);
      toast.success(`🔄 Auto-reconnected to ${wallet.name}!`);
    };

    window.addEventListener('walletsUpdated', handleWalletsUpdated);
    window.addEventListener('walletAutoReconnected', handleAutoReconnect as EventListener);

    // Stop detecting after 30 seconds
    const detectTimer = setTimeout(() => {
      setIsDetectingWallets(false);
      setAutoReconnectAttempted(true);
    }, 30000);

    return () => {
      window.removeEventListener('walletsUpdated', handleWalletsUpdated);
      window.removeEventListener('walletAutoReconnected', handleAutoReconnect as EventListener);
      clearTimeout(detectTimer);
    };
  }, []);

  const handleWalletConnected = async (wallet: ConnectedWallet) => {
    setIsLoadingBalance(true);
    try {
      const walletBalance = await solanaManager.getBalance(wallet.publicKey);
      setBalance(walletBalance);
      
      const walletState: WalletState = {
        connected: true,
        publicKey: wallet.publicKey,
        balance: walletBalance
      };
      
      onWalletConnected(walletState);
    } catch (error) {
      console.error('Error getting balance:', error);
      setBalance(0);
      
      const walletState: WalletState = {
        connected: true,
        publicKey: wallet.publicKey,
        balance: 0
      };
      
      onWalletConnected(walletState);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleConnect = async (walletName: string) => {
    setIsConnecting(true);
    try {
      const wallet = await walletManager.connectWallet(walletName);
      setConnectedWallet(wallet);
      await handleWalletConnected(wallet);
      toast.success(`Connected to ${walletName}!`);
    } catch (error: any) {
      console.error('Connection error:', error);
      
      if (error.message.includes('Redirecting to mobile app')) {
        toast.info(`Opening ${walletName} mobile app...`);
      } else {
        toast.error(error.message || `Failed to connect to ${walletName}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMobileWalletConnect = (wallet: WalletInfo) => {
    if (wallet.deepLink) {
      toast.info(`Opening ${wallet.name} app...`);
      window.location.href = wallet.deepLink;
    } else {
      toast.info(`Please install ${wallet.name} from the app store`);
      window.open(wallet.url, '_blank');
    }
  };

  const handleDisconnect = async () => {
    try {
      await walletManager.disconnectWallet();
      setConnectedWallet(null);
      setBalance(0);
      
      const walletState: WalletState = {
        connected: false,
        publicKey: null,
        balance: 0
      };
      
      onWalletConnected(walletState);
      toast.success('Wallet disconnected');
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  const handleRefreshBalance = async () => {
    if (!connectedWallet) return;
    
    setIsLoadingBalance(true);
    try {
      const walletBalance = await solanaManager.getBalance(connectedWallet.publicKey);
      setBalance(walletBalance);
      toast.success('Balance refreshed!');
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast.error('Failed to refresh balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleRefreshWallets = () => {
    setIsDetectingWallets(true);
    walletManager.refreshWalletDetection();
    toast.info('Refreshing wallet detection...');
    
    setTimeout(() => {
      setIsDetectingWallets(false);
    }, 5000);
  };

  const validateAndReconnect = async () => {
    if (!connectedWallet) return;
    
    const isValid = await walletManager.validateConnection();
    if (!isValid) {
      setConnectedWallet(null);
      setBalance(0);
      
      const walletState: WalletState = {
        connected: false,
        publicKey: null,
        balance: 0
      };
      
      onWalletConnected(walletState);
      toast.error('Wallet connection lost. Please reconnect.');
    }
  };

  // Validate connection periodically
  useEffect(() => {
    if (!connectedWallet) return;
    
    const interval = setInterval(validateAndReconnect, 30000);
    return () => clearInterval(interval);
  }, [connectedWallet]);

  if (connectedWallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Wallet Connected
            {isMobile && <Smartphone className="h-4 w-4 text-blue-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-lg">{connectedWallet.name === 'Phantom' ? '👻' : 
                                            connectedWallet.name === 'Solflare' ? '🔥' : 
                                            connectedWallet.name === 'Backpack' ? '🎒' : 
                                            connectedWallet.name === 'Glow' ? '✨' : 
                                            connectedWallet.name === 'Coinbase Wallet' ? '🔵' : 
                                            connectedWallet.name === 'Trust Wallet' ? '🛡️' : 
                                            connectedWallet.name === 'Slope' ? '📈' : 
                                            connectedWallet.name === 'Torus' ? '🌐' : '🔗'}</span>
              </div>
              <div>
                <div className="font-medium">{connectedWallet.name}</div>
                <div className="text-sm text-gray-600">
                  {connectedWallet.publicKey.slice(0, 8)}...{connectedWallet.publicKey.slice(-8)}
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Connected
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Balance</div>
              <div className="font-bold text-lg">
                {isLoadingBalance ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  `${balance.toFixed(4)} SOL`
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshBalance}
              disabled={isLoadingBalance}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleDisconnect}
              className="flex-1"
            >
              Disconnect
            </Button>
          </div>

          <div className="text-xs text-center text-gray-500">
            💾 Wallet stays connected across page refreshes
            {isMobile && <div>📱 Mobile wallet connected</div>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Wallet
          {isMobile && <Smartphone className="h-4 w-4 text-blue-600" />}
          {(isDetectingWallets || !autoReconnectAttempted) && (
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <Search className="h-3 w-3 animate-pulse" />
              Detecting...
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableWallets.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                Found {availableWallets.length} wallet{availableWallets.length !== 1 ? 's' : ''}:
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshWallets}
                disabled={isDetectingWallets}
              >
                <RefreshCw className={`h-3 w-3 ${isDetectingWallets ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="space-y-2">
              {availableWallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  variant="outline"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handleConnect(wallet.name)}
                  disabled={isConnecting}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{wallet.icon}</span>
                    <div className="text-left">
                      <div className="font-medium">{wallet.name}</div>
                      <div className="text-xs text-gray-500">
                        {isMobile ? 'Tap to connect' : 'Click to connect'}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="font-medium mb-2">No Wallets Detected</h3>
            <p className="text-sm text-gray-600 mb-4">
              {isDetectingWallets ? 'Still searching for wallets...' : 
               isMobile ? 'Install a Solana wallet app to get started:' : 
               'Install a Solana wallet extension to get started:'}
            </p>
            
            {!isDetectingWallets && (
              <>
                <div className="space-y-2 mb-4">
                  {allWallets.slice(0, isMobile ? 6 : 4).map((wallet) => (
                    <Button
                      key={wallet.name}
                      variant="outline"
                      size="sm"
                      onClick={() => isMobile ? handleMobileWalletConnect(wallet) : window.open(wallet.url, '_blank')}
                      className="w-full justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <span>{wallet.icon}</span>
                        {wallet.name}
                      </span>
                      {isMobile ? (
                        <Smartphone className="h-3 w-3" />
                      ) : (
                        <ExternalLink className="h-3 w-3" />
                      )}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshWallets}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Detection
                </Button>
              </>
            )}
            
            <div className="mt-4 text-xs text-gray-500">
              {isMobile ? (
                <>
                  📱 Tap wallet names above to open their mobile apps
                  <div className="mt-1">After installing, return to this page to connect</div>
                </>
              ) : (
                'After installing a wallet extension, refresh this page or click "Refresh Detection"'
              )}
            </div>
          </div>
        )}

        {isConnecting && (
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <div className="text-sm text-gray-600">
              {isMobile ? 'Opening wallet app...' : 'Connecting to wallet...'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
