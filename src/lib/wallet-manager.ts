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

    // Define all supported wallets with their detection logic
    const walletConfigs = [
      {
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-icon.svg',
        url: 'https://phantom.app/',
        detect: () => (window as any).phantom?.solana?.isPhantom
      },
      {
        name: 'Solflare',
        icon: 'https://solflare.com/assets/solflare-logo.svg',
        url: 'https://solflare.com/',
        detect: () => (window as any).solflare?.isSolflare
      },
      {
        name: 'Backpack',
        icon: 'https://backpack.app/backpack.png',
        url: 'https://backpack.app/',
        detect: () => (window as any).backpack?.isBackpack
      },
      {
        name: 'Glow',
        icon: 'https://glow.app/favicon.ico',
        url: 'https://glow.app/',
        detect: () => (window as any).glow
      },
      {
        name: 'Coinbase Wallet',
        icon: 'https://wallet.coinbase.com/favicon.ico',
        url: 'https://wallet.coinbase.com/',
        detect: () => (window as any).coinbaseSolana
      },
      {
        name: 'Trust Wallet',
        icon: 'https://trustwallet.com/favicon.ico',
        url: 'https://trustwallet.com/',
        detect: () => (window as any).trustwallet?.solana
      },
      {
        name: 'Slope',
        icon: 'https://slope.finance/favicon.ico',
        url: 'https://slope.finance/',
        detect: () => (window as any).Slope
      },
      {
        name: 'Torus',
        icon: 'https://tor.us/favicon.ico',
        url: 'https://tor.us/',
        detect: () => (window as any).torus
      }
    ];

    // Check each wallet
    for (const config of walletConfigs) {
      const isInstalled = config.detect();
      wallets.push({
        name: config.name,
        icon: config.icon,
        url: config.url,
        readyState: isInstalled ? 'Installed' : 'NotDetected'
      });
    }

    // Sort installed wallets first
    return wallets.sort((a, b) => {
      if (a.readyState === 'Installed' && b.readyState !== 'Installed') return -1;
      if (b.readyState === 'Installed' && a.readyState !== 'Installed') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private getWalletProvider(walletName: string): WalletProvider | null {
    const providers: Record<string, () => WalletProvider | null> = {
      'Phantom': () => (window as any).phantom?.solana,
      'Solflare': () => (window as any).solflare,
      'Backpack': () => (window as any).backpack,
      'Glow': () => (window as any).glow,
      'Coinbase Wallet': () => (window as any).coinbaseSolana,
      'Trust Wallet': () => (window as any).trustwallet?.solana,
      'Slope': () => (window as any).Slope,
      'Torus': () => (window as any).torus
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
