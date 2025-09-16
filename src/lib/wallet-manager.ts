// Enhanced wallet manager with better connection handling
export interface WalletAdapter {
  name: string;
  icon: string;
  url: string;
  readyState: 'Installed' | 'NotDetected' | 'Loadable' | 'Unsupported';
}

export interface WalletProvider {
  connect(): Promise<{ publicKey: any }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: any): Promise<any>;
  signAllTransactions(transactions: any[]): Promise<any[]>;
  publicKey: any;
  isConnected: boolean;
}

export class EnhancedWalletManager {
  private static instance: EnhancedWalletManager;
  private connectedWallet: WalletProvider | null = null;
  private walletName: string | null = null;

  static getInstance(): EnhancedWalletManager {
    if (!EnhancedWalletManager.instance) {
      EnhancedWalletManager.instance = new EnhancedWalletManager();
    }
    return EnhancedWalletManager.instance;
  }

  async getAvailableWallets(): Promise<WalletAdapter[]> {
    const wallets: WalletAdapter[] = [];

    // Check for Phantom
    if ((window as any).phantom?.solana?.isPhantom) {
      wallets.push({
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-icon.svg',
        url: 'https://phantom.app/',
        readyState: 'Installed'
      });
    }

    // Check for Solflare
    if ((window as any).solflare?.isSolflare) {
      wallets.push({
        name: 'Solflare',
        icon: 'https://solflare.com/assets/solflare-logo.svg',
        url: 'https://solflare.com/',
        readyState: 'Installed'
      });
    }

    // Check for Backpack
    if ((window as any).backpack?.isBackpack) {
      wallets.push({
        name: 'Backpack',
        icon: 'https://backpack.app/backpack.png',
        url: 'https://backpack.app/',
        readyState: 'Installed'
      });
    }

    // Check for Glow
    if ((window as any).glow) {
      wallets.push({
        name: 'Glow',
        icon: 'https://glow.app/favicon.ico',
        url: 'https://glow.app/',
        readyState: 'Installed'
      });
    }

    // Check for Coinbase Wallet
    if ((window as any).coinbaseSolana) {
      wallets.push({
        name: 'Coinbase Wallet',
        icon: 'https://wallet.coinbase.com/favicon.ico',
        url: 'https://wallet.coinbase.com/',
        readyState: 'Installed'
      });
    }

    // Check for Trust Wallet
    if ((window as any).trustwallet?.solana) {
      wallets.push({
        name: 'Trust Wallet',
        icon: 'https://trustwallet.com/favicon.ico',
        url: 'https://trustwallet.com/',
        readyState: 'Installed'
      });
    }

    // Add popular wallets that aren't installed
    const popularWallets = [
      { name: 'Phantom', url: 'https://phantom.app/' },
      { name: 'Solflare', url: 'https://solflare.com/' },
      { name: 'Backpack', url: 'https://backpack.app/' },
      { name: 'Glow', url: 'https://glow.app/' }
    ];

    for (const wallet of popularWallets) {
      if (!wallets.find(w => w.name === wallet.name)) {
        wallets.push({
          name: wallet.name,
          icon: '',
          url: wallet.url,
          readyState: 'NotDetected'
        });
      }
    }

    return wallets;
  }

  private getWalletProvider(walletName: string): WalletProvider | null {
    const providers: Record<string, () => WalletProvider | null> = {
      'Phantom': () => (window as any).phantom?.solana,
      'Solflare': () => (window as any).solflare,
      'Backpack': () => (window as any).backpack,
      'Glow': () => (window as any).glow,
      'Coinbase Wallet': () => (window as any).coinbaseSolana,
      'Trust Wallet': () => (window as any).trustwallet?.solana
    };

    const getProvider = providers[walletName];
    return getProvider ? getProvider() : null;
  }

  async connectWallet(walletName: string): Promise<{ publicKey: string; walletName: string }> {
    try {
      const provider = this.getWalletProvider(walletName);
      
      if (!provider) {
        throw new Error(`${walletName} wallet not found. Please install it first.`);
      }

      // Check if already connected
      if (provider.isConnected && provider.publicKey) {
        this.connectedWallet = provider;
        this.walletName = walletName;
        return {
          publicKey: provider.publicKey.toString(),
          walletName
        };
      }

      // Connect to wallet
      const response = await provider.connect();
      const publicKey = response.publicKey || provider.publicKey;

      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      this.connectedWallet = provider;
      this.walletName = walletName;

      return {
        publicKey: publicKey.toString(),
        walletName
      };
    } catch (error: any) {
      console.error(`Failed to connect to ${walletName}:`, error);
      
      if (error.code === 4001) {
        throw new Error('Wallet connection was rejected by user');
      }
      
      throw new Error(error.message || `Failed to connect to ${walletName}`);
    }
  }

  async disconnectWallet(): Promise<void> {
    if (this.connectedWallet) {
      try {
        await this.connectedWallet.disconnect();
      } catch (error) {
        console.error('Error disconnecting wallet:', error);
      }
      this.connectedWallet = null;
      this.walletName = null;
    }
  }

  getConnectedWallet(): { provider: WalletProvider; name: string } | null {
    if (this.connectedWallet && this.walletName) {
      return {
        provider: this.connectedWallet,
        name: this.walletName
      };
    }
    return null;
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }
    return await this.connectedWallet.signTransaction(transaction);
  }

  async signAllTransactions(transactions: any[]): Promise<any[]> {
    if (!this.connectedWallet) {
      throw new Error('No wallet connected');
    }
    return await this.connectedWallet.signAllTransactions(transactions);
  }
}

export const walletManager = EnhancedWalletManager.getInstance();