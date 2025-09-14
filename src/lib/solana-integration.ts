import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

// Treasury wallet for collecting fees
export const TREASURY_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';

// Solana connection (using devnet for testing)
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

export interface GameRoom {
  id: string;
  creator: string;
  opponent?: string;
  entranceFee: number;
  status: 'waiting' | 'active' | 'completed';
  createdAt: number;
  winner?: string;
}

export interface GameResult {
  winner: 'white' | 'black' | 'draw';
  moves: number;
  timestamp: number;
  whitePlayer: string;
  blackPlayer: string;
}

// Wallet detection
interface WalletAdapter {
  name: string;
  icon: string;
  url: string;
  readyState: 'Installed' | 'NotDetected';
  provider?: any;
}

const detectWallets = (): WalletAdapter[] => {
  const wallets: WalletAdapter[] = [];
  const win = window as any;
  
  // Check for Phantom (works on both desktop and mobile)
  if (win.phantom?.solana?.isPhantom) {
    wallets.push({
      name: 'Phantom',
      icon: 'https://phantom.app/img/phantom-logo.svg',
      url: 'https://phantom.app/',
      readyState: 'Installed',
      provider: win.phantom.solana
    });
  }
  
  // Check for Solflare (mobile and desktop)
  if (win.solflare?.isSolflare || win.solflare) {
    wallets.push({
      name: 'Solflare',
      icon: 'https://solflare.com/assets/logo.svg',
      url: 'https://solflare.com/',
      readyState: 'Installed',
      provider: win.solflare
    });
  }
  
  // Check for Backpack
  if (win.backpack?.isBackpack) {
    wallets.push({
      name: 'Backpack',
      icon: 'https://backpack.app/logo.png',
      url: 'https://backpack.app/',
      readyState: 'Installed',
      provider: win.backpack
    });
  }
  
  // Check for Glow
  if (win.glow) {
    wallets.push({
      name: 'Glow',
      icon: 'https://glow.app/logo.png',
      url: 'https://glow.app/',
      readyState: 'Installed',
      provider: win.glow
    });
  }
  
  // Mobile-specific detection
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Check for mobile wallet adapters
    if (win.solana && !wallets.find(w => w.name === 'Phantom')) {
      wallets.push({
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-logo.svg',
        url: 'https://phantom.app/',
        readyState: 'Installed',
        provider: win.solana
      });
    }
    
    // Check for Solflare mobile
    if (win.solflare && !wallets.find(w => w.name === 'Solflare')) {
      wallets.push({
        name: 'Solflare',
        icon: 'https://solflare.com/assets/logo.svg',
        url: 'https://solflare.com/',
        readyState: 'Installed',
        provider: win.solflare
      });
    }
  }
  
  // Add not detected wallets for installation
  const walletNames = ['Phantom', 'Solflare', 'Backpack', 'Glow'];
  walletNames.forEach(name => {
    if (!wallets.find(w => w.name === name)) {
      wallets.push({
        name,
        icon: name === 'Phantom' ? 'https://phantom.app/img/phantom-logo.svg' :
              name === 'Solflare' ? 'https://solflare.com/assets/logo.svg' :
              name === 'Backpack' ? 'https://backpack.app/logo.png' :
              'https://glow.app/logo.png',
        url: name === 'Phantom' ? 'https://phantom.app/' :
             name === 'Solflare' ? 'https://solflare.com/' :
             name === 'Backpack' ? 'https://backpack.app/' :
             'https://glow.app/',
        readyState: 'NotDetected'
      });
    }
  });
  
  return wallets;
};

export class SolanaGameManager {
  private connection: Connection;
  private wallet: any = null;

  constructor() {
    this.connection = connection;
  }

  async getAvailableWallets(): Promise<WalletAdapter[]> {
    return detectWallets();
  }

  async connectWallet(walletName?: string): Promise<WalletState> {
    try {
      let provider: any = null;
      
      // Get available wallets
      const availableWallets = detectWallets();
      const installedWallets = availableWallets.filter(w => w.readyState === 'Installed');
      
      if (installedWallets.length === 0) {
        throw new Error('No Solana wallet detected. Please install Phantom, Solflare, or another supported wallet.');
      }
      
      // If no specific wallet requested, show selection for multiple wallets
      if (!walletName) {
        if (installedWallets.length === 1) {
          // Only one wallet available, use it
          provider = installedWallets[0].provider;
          walletName = installedWallets[0].name;
        } else {
          // Multiple wallets available - trigger selection
          throw new Error('MULTIPLE_WALLETS_AVAILABLE');
        }
      } else {
        // Find specific wallet
        const selectedWallet = installedWallets.find(w => w.name.toLowerCase() === walletName.toLowerCase());
        if (!selectedWallet) {
          throw new Error(`${walletName} wallet not found. Please install it first.`);
        }
        provider = selectedWallet.provider;
      }

      if (!provider) {
        throw new Error('Wallet provider not found');
      }

      // Connect to the wallet
      const response = await provider.connect();
      this.wallet = provider;
      
      const publicKey = response.publicKey || provider.publicKey;
      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      const balance = await this.getBalance(publicKey);
      
      return {
        connected: true,
        publicKey: publicKey.toString(),
        balance
      };
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      if (error.message === 'MULTIPLE_WALLETS_AVAILABLE') {
        throw error;
      }
      
      if (error.code === 4001) {
        throw new Error('Wallet connection was rejected by user');
      }
      
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  async requestAirdrop(publicKey: PublicKey, amount: number): Promise<string> {
    try {
      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error: any) {
      console.error('Airdrop error:', error);
      
      if (error.message?.includes('airdrop request limit')) {
        throw new Error('Airdrop limit reached. Please try again later or use a different wallet.');
      }
      
      throw new Error('Failed to request airdrop. Please try again.');
    }
  }

  async sendTransaction(transaction: Transaction): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signedTransaction = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error: any) {
      console.error('Transaction error:', error);
      throw new Error(error.message || 'Transaction failed');
    }
  }

  // Game management methods (using localStorage for demo)
  async createGame(creator: string, entranceFee: number): Promise<GameRoom> {
    const gameRoom: GameRoom = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creator,
      entranceFee,
      status: 'waiting',
      createdAt: Date.now()
    };

    // Store in localStorage (in production, this would be on-chain)
    const existingGames = JSON.parse(localStorage.getItem('chess_games') || '[]');
    existingGames.push(gameRoom);
    localStorage.setItem('chess_games', JSON.stringify(existingGames));

    return gameRoom;
  }

  async getAvailableGames(): Promise<GameRoom[]> {
    try {
      const games = JSON.parse(localStorage.getItem('chess_games') || '[]');
      
      // Filter out old games (older than 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const activeGames = games.filter((game: GameRoom) => 
        game.createdAt > oneDayAgo && game.status !== 'completed'
      );
      
      // Update localStorage with filtered games
      localStorage.setItem('chess_games', JSON.stringify(activeGames));
      
      return activeGames;
    } catch (error) {
      console.error('Error getting games:', error);
      return [];
    }
  }

  async joinGame(gameId: string, opponent: string): Promise<GameRoom> {
    const games = JSON.parse(localStorage.getItem('chess_games') || '[]');
    const gameIndex = games.findIndex((game: GameRoom) => game.id === gameId);
    
    if (gameIndex === -1) {
      throw new Error('Game not found');
    }
    
    const game = games[gameIndex];
    
    if (game.status !== 'waiting') {
      throw new Error('Game is no longer available');
    }
    
    if (game.creator === opponent) {
      throw new Error('Cannot join your own game');
    }
    
    // Update game with opponent
    games[gameIndex] = {
      ...game,
      opponent,
      status: 'active'
    };
    
    localStorage.setItem('chess_games', JSON.stringify(games));
    return games[gameIndex];
  }

  async completeGame(gameId: string, winner: string): Promise<void> {
    const games = JSON.parse(localStorage.getItem('chess_games') || '[]');
    const gameIndex = games.findIndex((game: GameRoom) => game.id === gameId);
    
    if (gameIndex !== -1) {
      games[gameIndex] = {
        ...games[gameIndex],
        status: 'completed',
        winner
      };
      
      localStorage.setItem('chess_games', JSON.stringify(games));
    }
  }

  // Payment methods (simplified for demo)
  async processPayment(from: string, to: string, amount: number): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const fromPubkey = new PublicKey(from);
      const toPubkey = new PublicKey(to);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount * LAMPORTS_PER_SOL
        })
      );

      return await this.sendTransaction(transaction);
    } catch (error: any) {
      console.error('Payment error:', error);
      throw new Error(error.message || 'Payment failed');
    }
  }
}
