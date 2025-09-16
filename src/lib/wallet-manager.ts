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
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  private wallets: WalletInfo[] = [
    {
      name: 'Phantom',
      icon: 'https://phantom.app/img/phantom-logo.svg',
      url: 'https://phantom.app/',
      provider: null
    },
    {
      name: 'Solflare',
      icon: 'https://solflare.com/assets/solflare-logo.svg',
      url: 'https://solflare.com/',
      provider: null
    },
    {
      name: 'Backpack',
      icon: 'https://backpack.app/icon.png',
      url: 'https://backpack.app/',
      provider: null
    },
    {
      name: 'Glow',
      icon: 'https://glow.app/favicon.ico',
      url: 'https://glow.app/',
      provider: null
    },
    {
      name: 'Coinbase Wallet',
      icon: 'https://wallet.coinbase.com/assets/images/favicon.ico',
      url: 'https://wallet.coinbase.com/',
      provider: null
    },
    {
      name: 'Trust Wallet',
      icon: 'https://trustwallet.com/assets/images/favicon.ico',
      url: 'https://trustwallet.com/',
      provider: null
    },
    {
      name: 'Slope',
      icon: 'https://slope.finance/favicon.ico',
      url: 'https://slope.finance/',
      provider: null
    },
    {
      name: 'Exodus',
      icon: 'https://exodus.com/favicon.ico',
      url: 'https://exodus.com/',
      provider: null
    }
  ];

  constructor() {
    this.initializeWallets();
    this.attemptAutoReconnect();
  }

  private initializeWallets() {
    if (typeof window === 'undefined') return;

    // Check for wallet providers
    this.wallets.forEach(wallet => {
      switch (wallet.name) {
        case 'Phantom':
          wallet.provider = (window as any).phantom?.solana;
          break;
        case 'Solflare':
          wallet.provider = (window as any).solflare;
          break;
        case 'Backpack':
          wallet.provider = (window as any).backpack;
          break;
        case 'Glow':
          wallet.provider = (window as any).glow;
          break;
        case 'Coinbase Wallet':
          wallet.provider = (window as any).coinbaseSolana;
          break;
        case 'Trust Wallet':
          wallet.provider = (window as any).trustwallet?.solana;
          break;
        case 'Slope':
          wallet.provider = (window as any).Slope;
          break;
        case 'Exodus':
          wallet.provider = (window as any).exodus?.solana;
          break;
      }
    });

    console.log('🔍 Wallet detection complete:', this.wallets.map(w => ({
      name: w.name,
      detected: !!w.provider
    })));
  }

  private async attemptAutoReconnect() {
    if (typeof window === 'undefined') return;

    try {
      // Check for stored wallet session
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
      const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
      
      if (sessionAge > SESSION_TIMEOUT) {
        console.log('🔄 Wallet session expired');
        this.clearStoredWallet();
        return;
      }

      console.log(`🔄 Attempting to reconnect to ${walletData.name}...`);
      
      // Find the wallet provider
      const wallet = this.wallets.find(w => w.name === walletData.name);
      if (!wallet?.provider) {
        console.log(`🔄 ${walletData.name} provider not found`);
        this.clearStoredWallet();
        return;
      }

      // Attempt to reconnect
      if (wallet.provider.isConnected) {
        this.connectedWallet = {
          name: walletData.name,
          publicKey: walletData.publicKey,
          provider: wallet.provider
        };
        
        // Update session timestamp
        this.updateWalletSession();
        
        console.log(`✅ Auto-reconnected to ${walletData.name}`);
        
        // Trigger reconnection event
        window.dispatchEvent(new CustomEvent('walletAutoReconnected', {
          detail: this.connectedWallet
        }));
      } else {
        console.log(`🔄 ${walletData.name} not connected, attempting connection...`);
        await this.connectWallet(walletData.name);
      }
    } catch (error) {
      console.error('🔄 Auto-reconnect failed:', error);
      this.clearStoredWallet();
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
      if (walletName === 'Phantom' || walletName === 'Solflare' || walletName === 'Backpack') {
        response = await wallet.provider.connect();
      } else if (walletName === 'Glow') {
        response = await wallet.provider.connect();
      } else if (walletName === 'Coinbase Wallet') {
        response = await wallet.provider.connect();
      } else if (walletName === 'Trust Wallet') {
        response = await wallet.provider.connect();
      } else if (walletName === 'Slope') {
        response = await wallet.provider.connect();
      } else if (walletName === 'Exodus') {
        response = await wallet.provider.connect();
      } else {
        response = await wallet.provider.connect();
      }

      const publicKey = response.publicKey?.toString() || response.toString();
      
      this.connectedWallet = {
        name: walletName,
        publicKey,
        provider: wallet.provider
      };

      // Store wallet connection for persistence
      this.storeWalletConnection();
      
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
      
      // Attempt to disconnect from the wallet
      if (this.connectedWallet.provider?.disconnect) {
        await this.connectedWallet.provider.disconnect();
      }
      
      // Clear stored data
      this.clearStoredWallet();
      
      console.log(`✅ Disconnected from ${this.connectedWallet.name}`);
      this.connectedWallet = null;
    } catch (error) {
      console.error('❌ Error disconnecting wallet:', error);
      // Force disconnect even if there's an error
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

  // Check if wallet is still connected (for session validation)
  async validateConnection(): Promise<boolean> {
    if (!this.connectedWallet) return false;

    try {
      // Check if the wallet provider is still connected
      if (this.connectedWallet.provider?.isConnected === false) {
        console.log('🔄 Wallet provider disconnected, clearing session');
        this.clearStoredWallet();
        this.connectedWallet = null;
        return false;
      }

      // Update session timestamp on successful validation
      this.updateWalletSession();
      return true;
    } catch (error) {
      console.error('Error validating wallet connection:', error);
      return false;
    }
  }

  // Get stored wallet info without connecting
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
}

export const walletManager = new WalletManager();
