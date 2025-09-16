import { safeLocalStorage, safeJSONParse, safeJSONStringify } from './storage-utils';

export interface WalletInfo {
  name: string;
  icon: string;
  url: string;
  provider?: any;
}

export interface ConnectedWallet {
  name: string;
  publicKey: string;
  provider: any;
}

class WalletManager {
  private readonly WALLET_STORAGE_KEY = 'solana_chess_connected_wallet';
  private readonly WALLET_SESSION_KEY = 'solana_chess_wallet_session';
  private connectedWallet: ConnectedWallet | null = null;
  private walletCheckInterval: any = null;

  private wallets: WalletInfo[] = [
    {
      name: 'Phantom',
      icon: '👻',
      url: 'https://phantom.app/',
      provider: null
    },
    {
      name: 'Solflare',
      icon: '🔥',
      url: 'https://solflare.com/',
      provider: null
    },
    {
      name: 'Backpack',
      icon: '🎒',
      url: 'https://backpack.app/',
      provider: null
    },
    {
      name: 'Glow',
      icon: '✨',
      url: 'https://glow.app/',
      provider: null
    },
    {
      name: 'Coinbase Wallet',
      icon: '🔵',
      url: 'https://wallet.coinbase.com/',
      provider: null
    },
    {
      name: 'Trust Wallet',
      icon: '🛡️',
      url: 'https://trustwallet.com/',
      provider: null
    },
    {
      name: 'Slope',
      icon: '📈',
      url: 'https://slope.finance/',
      provider: null
    },
    {
      name: 'Sollet',
      icon: '🔗',
      url: 'https://www.sollet.io/',
      provider: null
    }
  ];

  constructor() {
    this.initializeWallets();
    this.startWalletDetection();
    this.attemptAutoReconnect();
  }

  private initializeWallets() {
    if (typeof window === 'undefined') return;

    console.log('🔍 Detecting wallets...');
    
    // Check for wallet providers with multiple detection methods
    this.wallets.forEach(wallet => {
      switch (wallet.name) {
        case 'Phantom':
          wallet.provider = (window as any).phantom?.solana || (window as any).solana;
          break;
        case 'Solflare':
          wallet.provider = (window as any).solflare || (window as any).SolflareApp;
          break;
        case 'Backpack':
          wallet.provider = (window as any).backpack || (window as any).xnft?.solana;
          break;
        case 'Glow':
          wallet.provider = (window as any).glow;
          break;
        case 'Coinbase Wallet':
          wallet.provider = (window as any).coinbaseSolana || (window as any).coinbaseWalletExtension?.solana;
          break;
        case 'Trust Wallet':
          wallet.provider = (window as any).trustwallet?.solana;
          break;
        case 'Slope':
          wallet.provider = (window as any).Slope;
          break;
        case 'Sollet':
          wallet.provider = (window as any).sollet;
          break;
      }
    });

    const detectedWallets = this.wallets.filter(w => w.provider);
    console.log(`🔍 Detected ${detectedWallets.length} wallets:`, detectedWallets.map(w => w.name));
  }

  private startWalletDetection() {
    // Check for new wallets every 2 seconds for the first 30 seconds
    let attempts = 0;
    const maxAttempts = 15;
    
    this.walletCheckInterval = setInterval(() => {
      attempts++;
      const previousCount = this.wallets.filter(w => w.provider).length;
      
      this.initializeWallets();
      
      const currentCount = this.wallets.filter(w => w.provider).length;
      
      if (currentCount > previousCount) {
        console.log(`🔍 New wallets detected! Total: ${currentCount}`);
        // Dispatch event to update UI
        window.dispatchEvent(new CustomEvent('walletsUpdated'));
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(this.walletCheckInterval);
        console.log('🔍 Wallet detection completed');
      }
    }, 2000);
  }

  private async attemptAutoReconnect() {
    if (typeof window === 'undefined') return;

    try {
      const storedWallet = safeLocalStorage.getItem(this.WALLET_STORAGE_KEY);
      const sessionData = safeLocalStorage.getItem(this.WALLET_SESSION_KEY);
      
      if (!storedWallet || !sessionData) {
        console.log('🔄 No stored wallet session found');
        return;
      }

      const walletData = safeJSONParse(storedWallet, null);
      const session = safeJSONParse(sessionData, null);
      
      if (!walletData || !session) {
        console.log('🔄 Invalid stored wallet data');
        this.clearStoredWallet();
        return;
      }

      // Check if session is still valid (24 hours)
      const sessionAge = Date.now() - session.timestamp;
      const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
      
      if (sessionAge > SESSION_TIMEOUT) {
        console.log('🔄 Wallet session expired');
        this.clearStoredWallet();
        return;
      }

      console.log(`🔄 Attempting to reconnect to ${walletData.name}...`);
      
      // Wait a bit for wallets to load, then try to reconnect
      setTimeout(async () => {
        try {
          await this.reconnectStoredWallet(walletData);
        } catch (error) {
          console.error('🔄 Auto-reconnect failed:', error);
          this.clearStoredWallet();
        }
      }, 3000);
      
    } catch (error) {
      console.error('🔄 Auto-reconnect error:', error);
      this.clearStoredWallet();
    }
  }

  private async reconnectStoredWallet(walletData: any) {
    const wallet = this.wallets.find(w => w.name === walletData.name);
    if (!wallet?.provider) {
      console.log(`🔄 ${walletData.name} provider not found`);
      return;
    }

    try {
      // Try to connect silently first
      if (wallet.provider.isConnected) {
        this.connectedWallet = {
          name: walletData.name,
          publicKey: wallet.provider.publicKey?.toString() || walletData.publicKey,
          provider: wallet.provider
        };
        
        this.updateWalletSession();
        console.log(`✅ Auto-reconnected to ${walletData.name}`);
        
        // Dispatch reconnection event
        window.dispatchEvent(new CustomEvent('walletAutoReconnected', {
          detail: this.connectedWallet
        }));
        return;
      }

      // Try silent connection
      if (wallet.provider.connect) {
        await wallet.provider.connect({ onlyIfTrusted: true });
        
        if (wallet.provider.isConnected && wallet.provider.publicKey) {
          this.connectedWallet = {
            name: walletData.name,
            publicKey: wallet.provider.publicKey.toString(),
            provider: wallet.provider
          };
          
          this.updateWalletSession();
          console.log(`✅ Silently reconnected to ${walletData.name}`);
          
          // Dispatch reconnection event
          window.dispatchEvent(new CustomEvent('walletAutoReconnected', {
            detail: this.connectedWallet
          }));
        }
      }
    } catch (error) {
      console.log(`🔄 Silent reconnection failed for ${walletData.name}:`, error);
    }
  }

  getAvailableWallets(): WalletInfo[] {
    return this.wallets.filter(wallet => wallet.provider);
  }

  getAllWallets(): WalletInfo[] {
    return this.wallets;
  }

  async connectWallet(walletName: string): Promise<ConnectedWallet> {
    const wallet = this.wallets.find(w => w.name === walletName);
    
    if (!wallet) {
      throw new Error(`Wallet ${walletName} not supported`);
    }

    if (!wallet.provider) {
      throw new Error(`${walletName} not installed. Please install it from ${wallet.url}`);
    }

    try {
      console.log(`🔗 Connecting to ${walletName}...`);
      
      let response;
      
      // Handle different wallet connection methods
      if (wallet.provider.connect) {
        response = await wallet.provider.connect();
      } else {
        throw new Error(`${walletName} does not support connection`);
      }

      const publicKey = response?.publicKey?.toString() || wallet.provider.publicKey?.toString();
      
      if (!publicKey) {
        throw new Error('Failed to get public key from wallet');
      }

      this.connectedWallet = {
        name: walletName,
        publicKey,
        provider: wallet.provider
      };

      // Store wallet connection for persistence
      this.storeWalletConnection();
      
      // Set up disconnect listener
      if (wallet.provider.on) {
        wallet.provider.on('disconnect', () => {
          console.log('👋 Wallet disconnected');
          this.connectedWallet = null;
          this.clearStoredWallet();
        });
      }

      console.log(`✅ Connected to ${walletName}: ${publicKey}`);
      return this.connectedWallet;
    } catch (error: any) {
      console.error(`❌ Failed to connect to ${walletName}:`, error);
      
      if (error.message?.includes('User rejected')) {
        throw new Error('Connection cancelled by user');
      }
      
      throw new Error(`Failed to connect to ${walletName}: ${error.message || 'Unknown error'}`);
    }
  }

  private storeWalletConnection() {
    if (!this.connectedWallet) return;

    try {
      const walletData = {
        name: this.connectedWallet.name,
        publicKey: this.connectedWallet.publicKey
      };

      const sessionData = {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        connected: true
      };

      safeLocalStorage.setItem(this.WALLET_STORAGE_KEY, safeJSONStringify(walletData) || '');
      safeLocalStorage.setItem(this.WALLET_SESSION_KEY, safeJSONStringify(sessionData) || '');
      
      console.log('💾 Wallet connection stored for persistence');
    } catch (error) {
      console.error('Error storing wallet connection:', error);
    }
  }

  private updateWalletSession() {
    try {
      const sessionData = {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        connected: true
      };

      safeLocalStorage.setItem(this.WALLET_SESSION_KEY, safeJSONStringify(sessionData) || '');
    } catch (error) {
      console.error('Error updating wallet session:', error);
    }
  }

  private clearStoredWallet() {
    try {
      safeLocalStorage.removeItem(this.WALLET_STORAGE_KEY);
      safeLocalStorage.removeItem(this.WALLET_SESSION_KEY);
      console.log('🗑️ Cleared stored wallet data');
    } catch (error) {
      console.error('Error clearing stored wallet:', error);
    }
  }

  async disconnectWallet(): Promise<void> {
    if (!this.connectedWallet) return;

    try {
      console.log(`🔌 Disconnecting from ${this.connectedWallet.name}...`);
      
      if (this.connectedWallet.provider?.disconnect) {
        await this.connectedWallet.provider.disconnect();
      }
      
      this.clearStoredWallet();
      
      console.log(`✅ Disconnected from ${this.connectedWallet.name}`);
      this.connectedWallet = null;
    } catch (error) {
      console.error('❌ Error disconnecting wallet:', error);
      this.connectedWallet = null;
      this.clearStoredWallet();
    }
  }

  getConnectedWallet(): ConnectedWallet | null {
    return this.connectedWallet;
  }

  isWalletConnected(): boolean {
    return this.connectedWallet !== null;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.connectedWallet) return false;

    try {
      if (this.connectedWallet.provider?.isConnected === false) {
        console.log('🔄 Wallet provider disconnected, clearing session');
        this.clearStoredWallet();
        this.connectedWallet = null;
        return false;
      }

      this.updateWalletSession();
      return true;
    } catch (error) {
      console.error('Error validating wallet connection:', error);
      return false;
    }
  }

  getStoredWalletInfo(): { name: string; publicKey: string } | null {
    try {
      const storedWallet = safeLocalStorage.getItem(this.WALLET_STORAGE_KEY);
      if (!storedWallet) return null;
      
      return safeJSONParse(storedWallet, null);
    } catch (error) {
      console.error('Error getting stored wallet info:', error);
      return null;
    }
  }

  // Force refresh wallet detection
  refreshWalletDetection() {
    console.log('🔄 Forcing wallet detection refresh...');
    this.initializeWallets();
    window.dispatchEvent(new CustomEvent('walletsUpdated'));
  }

  // Cleanup
  destroy() {
    if (this.walletCheckInterval) {
      clearInterval(this.walletCheckInterval);
    }
  }
}

export const walletManager = new WalletManager();
