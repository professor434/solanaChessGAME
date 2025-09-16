import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { walletManager, WalletAdapter } from '@/lib/wallet-manager';
import { SolanaGameManager, WalletState } from '@/lib/solana-integration';

interface WalletConnectProps {
  onWalletConnected: (walletState: WalletState) => void;
  solanaManager: SolanaGameManager;
}

export default function WalletConnect({ onWalletConnected, solanaManager }: WalletConnectProps) {
  const [availableWallets, setAvailableWallets] = useState<WalletAdapter[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });

  useEffect(() => {
    loadAvailableWallets();
    // Refresh wallet list every 2 seconds to detect newly installed wallets
    const interval = setInterval(loadAvailableWallets, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadAvailableWallets = async () => {
    try {
      const wallets = await walletManager.getAvailableWallets();
      setAvailableWallets(wallets);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const handleConnectWallet = async (walletName: string) => {
    if (walletState.connected) {
      await handleDisconnect();
      return;
    }

    setIsConnecting(true);
    try {
      const { publicKey, walletName: connectedName } = await walletManager.connectWallet(walletName);
      
      // Get balance using Solana manager
      const balance = await solanaManager.getBalance(publicKey);
      
      const newWalletState: WalletState = {
        connected: true,
        publicKey,
        balance
      };

      setWalletState(newWalletState);
      setConnectedWallet(connectedName);
      onWalletConnected(newWalletState);
      
      toast.success(`Connected to ${connectedName}!`);
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await walletManager.disconnectWallet();
      
      const disconnectedState: WalletState = {
        connected: false,
        publicKey: null,
        balance: 0
      };

      setWalletState(disconnectedState);
      setConnectedWallet(null);
      onWalletConnected(disconnectedState);
      
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  const openWalletUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (walletState.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Wallet Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{connectedWallet}</div>
              <div className="text-sm text-gray-600">
                {formatAddress(walletState.publicKey!)}
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Connected
            </Badge>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Balance</div>
            <div className="text-lg font-bold">{walletState.balance.toFixed(4)} SOL</div>
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

  const installedWallets = availableWallets.filter(w => w.readyState === 'Installed');
  const notInstalledWallets = availableWallets.filter(w => w.readyState === 'NotDetected');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Installed Wallets */}
          {installedWallets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Available Wallets</h3>
              {installedWallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  onClick={() => handleConnectWallet(wallet.name)}
                  disabled={isConnecting}
                  className="w-full justify-between"
                  variant="outline"
                >
                  <div className="flex items-center gap-2">
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name} 
                      className="w-5 h-5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{wallet.name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Ready
                  </Badge>
                </Button>
              ))}
            </div>
          )}

          {/* Not Installed Wallets */}
          {notInstalledWallets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">
                {installedWallets.length > 0 ? 'More Wallets' : 'Install a Wallet'}
              </h3>
              {notInstalledWallets.slice(0, 6).map((wallet) => (
                <div key={wallet.name} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name} 
                      className="w-5 h-5 opacity-50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-gray-600">{wallet.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-gray-500">
                      Not Installed
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openWalletUrl(wallet.url)}
                      title={`Install ${wallet.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Wallets Message */}
          {installedWallets.length === 0 && (
            <div className="text-center py-6">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 mb-2">No Wallets Detected</h3>
              <p className="text-sm text-gray-600 mb-4">
                Install a Solana wallet to start playing with real SOL stakes
              </p>
              <div className="text-xs text-gray-500">
                We recommend starting with Phantom - it's the most popular Solana wallet
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAvailableWallets}
              className="w-full text-xs"
            >
              🔄 Refresh Wallet List
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
