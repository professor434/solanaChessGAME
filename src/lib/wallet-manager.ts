export interface WalletInfo {
  name: string;
  icon: string;
  url: string;
  adapter?: any;
  deepLink?: string;
}

export interface ConnectedWallet {
  name: string;
  publicKey: string;
  adapter?: any;
}

class WalletManager {
  private connectedWallet: ConnectedWallet | null = null;
  private detectionInterval: NodeJS.Timeout | null = null;

  private wallets: WalletInfo[] = [
    {
      name: 'Phantom',
      icon: '👻',
      url: 'https://phantom.app/',
      deepLink: 'https://phantom.app/ul/browse/https%3A//solana-chess-game.vercel.app%3Fref%3Dphantom'
    },
    {
      name: 'Solflare',
      icon: '🔥',
      url: 'https://solflare.com/',
      deepLink: 'https://solflare.com/ul/browse/https%3A//solana-chess-game.vercel.app%3Fref%3Dsolflare'
    },
    {
      name: 'Backpack',
      icon: '🎒',
      url: 'https://backpack.app/',
      deepLink: 'https://backpack.app/browse/https%3A//solana-chess-game.vercel.app%3Fref%3Dbackpack'
    },
    {
      name: 'Glow',
      icon: '✨',
      url: 'https://glow.app/',
      deepLink: 'https://glow.app/browse/https%3A//solana-chess-game.vercel.app%3Fref%3Dglow'
    },
    {
      name: 'Coinbase Wallet',
      icon: '🔵',
      url: 'https://www.coinbase.com/wallet',
      deepLink: 'https://go.cb-w.com/dapp?cb_url=https%3A//solana-chess-game.vercel.app%3Fref%3Dcoinbase'
    },
    {
      name: 'Trust Wallet',
      icon: '🛡️',
      url: 'https://trustwallet.com/',
      deepLink: 'https://link.trustwallet.com/open_url?coin_id=501&url=https%3A//solana-chess-game.vercel.app%3Fref%3Dtrust'
    }
  ];

  constructor() {
    this.startWalletDetection();
    this.loadSavedConnection();
  }

  private startWalletDetection() {
    this.detectWallets();
    
    this.detectionInterval = setInterval(() => {
      this.detectWallets();
    }, 2000);

    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => this.detectWallets());
      document.addEventListener('DOMContentLoaded', () => this.detectWallets());
    }
  }

  private detectWallets() {
    const availableWallets = this.getAvailableWallets();
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('walletsUpdated', { 
        detail: availableWallets 
      }));
    }
  }

  getAvailableWallets(): WalletInfo[] {
    const available: WalletInfo[] = [];
    
    if (typeof window === 'undefined') return available;

    // Check for Phantom
    if (window.solana && window.solana.isPhantom) {
      const phantom = this.wallets.find(w => w.name === 'Phantom');
      if (phantom) {
        available.push({ ...phantom, adapter: window.solana });
      }
    }

    // Check for Solflare
    if (window.solflare && window.solflare.isSolflare) {
      const solflare = this.wallets.find(w => w.name === 'Solflare');
      if (solflare) {
        available.push({ ...solflare, adapter: window.solflare });
      }
    }

    // Check for Backpack
    if (window.backpack && window.backpack.isBackpack) {
      const backpack = this.wallets.find(w => w.name === 'Backpack');
      if (backpack) {
        available.push({ ...backpack, adapter: window.backpack });
      }
    }

    // Check for Glow
    if (window.glow) {
      const glow = this.wallets.find(w => w.name === 'Glow');
      if (glow) {
        available.push({ ...glow, adapter: window.glow });
      }
    }

    // Check for Coinbase Wallet
    if (window.coinbaseSolana) {
      const coinbase = this.wallets.find(w => w.name === 'Coinbase Wallet');
      if (coinbase) {
        available.push({ ...coinbase, adapter: window.coinbaseSolana });
      }
    }

    // Check for Trust Wallet
    if (window.trustwallet) {
      const trust = this.wallets.find(w => w.name === 'Trust Wallet');
      if (trust) {
        available.push({ ...trust, adapter: window.trustwallet });
      }
    }

    console.log(`🔍 Detected ${available.length} wallets:`, available.map(w => w.name));
    return available;
  }

  getAllWallets(): WalletInfo[] {
    return [...this.wallets];
  }

  async connectWallet(walletName: string): Promise<ConnectedWallet> {
    const availableWallets = this.getAvailableWallets();
    const wallet = availableWallets.find(w => w.name === walletName);
    
    if (!wallet || !wallet.adapter) {
      if (this.isMobile() && wallet) {
        this.redirectToMobileWallet(wallet);
        throw new Error(`${walletName} not installed. Redirecting to mobile app...`);
      }
      throw new Error(`${walletName} wallet not found or not installed`);
    }

    try {
      console.log(`🔗 Connecting to ${walletName}...`);
      
      const response = await wallet.adapter.connect();

      if (!response.publicKey) {
        throw new Error('No public key returned from wallet');
      }

      const publicKey = response.publicKey.toString();
      
      const connectedWallet: ConnectedWallet = {
        name: walletName,
        publicKey,
        adapter: wallet.adapter
      };

      this.connectedWallet = connectedWallet;
      this.saveConnection(connectedWallet);
      
      console.log(`✅ Connected to ${walletName}:`, publicKey);
      return connectedWallet;
      
    } catch (error: any) {
      console.error(`❌ Failed to connect to ${walletName}:`, error);
      
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      } else if (error.code === -32002) {
        throw new Error('Connection request already pending');
      } else {
        throw new Error(error.message || `Failed to connect to ${walletName}`);
      }
    }
  }

  async disconnectWallet(): Promise<void> {
    if (!this.connectedWallet) return;

    try {
      if (this.connectedWallet.adapter && this.connectedWallet.adapter.disconnect) {
        await this.connectedWallet.adapter.disconnect();
      }
      
      this.connectedWallet = null;
      this.clearSavedConnection();
      
      console.log('🔌 Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      this.connectedWallet = null;
      this.clearSavedConnection();
    }
  }

  getConnectedWallet(): ConnectedWallet | null {
    return this.connectedWallet;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.connectedWallet || !this.connectedWallet.adapter) {
      return false;
    }

    try {
      const isConnected = this.connectedWallet.adapter.isConnected || 
                         this.connectedWallet.adapter.connected ||
                         (this.connectedWallet.adapter.publicKey !== null);
      
      if (!isConnected) {
        this.connectedWallet = null;
        this.clearSavedConnection();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating connection:', error);
      this.connectedWallet = null;
      this.clearSavedConnection();
      return false;
    }
  }

  refreshWalletDetection(): void {
    console.log('🔄 Refreshing wallet detection...');
    this.detectWallets();
  }

  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  private redirectToMobileWallet(wallet: WalletInfo): void {
    if (!wallet.deepLink) {
      window.open(wallet.url, '_blank');
      return;
    }

    console.log(`📱 Redirecting to ${wallet.name} mobile app...`);
    
    window.location.href = wallet.deepLink;
    
    setTimeout(() => {
      window.open(wallet.url, '_blank');
    }, 2000);
  }

  private saveConnection(wallet: ConnectedWallet): void {
    try {
      localStorage.setItem('connectedWallet', JSON.stringify({
        name: wallet.name,
        publicKey: wallet.publicKey
      }));
    } catch (error) {
      console.error('Failed to save wallet connection:', error);
    }
  }

  private loadSavedConnection(): void {
    try {
      const saved = localStorage.getItem('connectedWallet');
      if (saved) {
        const { name, publicKey } = JSON.parse(saved);
        
        setTimeout(() => {
          this.attemptAutoReconnect(name, publicKey);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load saved connection:', error);
    }
  }

  private async attemptAutoReconnect(walletName: string, expectedPublicKey: string): Promise<void> {
    try {
      const availableWallets = this.getAvailableWallets();
      const wallet = availableWallets.find(w => w.name === walletName);
      
      if (!wallet || !wallet.adapter) {
        console.log(`❌ ${walletName} not available for auto-reconnect`);
        return;
      }

      const response = await wallet.adapter.connect({ onlyIfTrusted: true });

      if (response.publicKey && response.publicKey.toString() === expectedPublicKey) {
        const connectedWallet: ConnectedWallet = {
          name: walletName,
          publicKey: expectedPublicKey,
          adapter: wallet.adapter
        };

        this.connectedWallet = connectedWallet;
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('walletAutoReconnected', { 
            detail: connectedWallet 
          }));
        }
        
        console.log(`🔄 Auto-reconnected to ${walletName}`);
      }
    } catch (error) {
      console.log(`❌ Auto-reconnect failed for ${walletName}:`, error);
    }
  }

  private clearSavedConnection(): void {
    try {
      localStorage.removeItem('connectedWallet');
    } catch (error) {
      console.error('Failed to clear saved connection:', error);
    }
  }

  destroy(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }
}

export const walletManager = new WalletManager();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    walletManager.destroy();
  });
}
