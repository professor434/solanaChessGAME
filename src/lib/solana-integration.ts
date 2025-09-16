import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { safeLocalStorage, safeJSONParse, safeJSONStringify } from './storage-utils';

// Treasury wallet for collecting fees - EXPORTED
export const TREASURY_WALLET = '42SoggCv1oXBhNWicmAJir3arYiS2NCMveWpUkixYXzj';

// Types
export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

export interface GameRoom {
  id: string;
  creator: string;
  opponent: string | null;
  entranceFee: number;
  status: 'waiting' | 'active' | 'completed';
  winner: string | null;
  createdAt: number;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  totalEarnings: number;
  totalSpent: number;
}

export interface GameResult {
  winner: 'white' | 'black' | 'draw';
  moves: number;
  timestamp: number;
  whitePlayer: string;
  blackPlayer: string;
}

// Solana configuration with your QuickNode RPC endpoint
const RPC_ENDPOINTS = [
  'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f',
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com'
];

// Global storage key for cross-browser game sharing
const GLOBAL_GAMES_KEY = 'solana_chess_global_games';
const GLOBAL_STATS_KEY = 'solana_chess_global_stats';

// Detect available wallets
const detectWallets = () => {
  if (typeof window === 'undefined') return [];
  
  const wallets = [];
  
  // Check for Phantom
  if ((window as any).phantom?.solana?.isPhantom) {
    wallets.push({ name: 'Phantom', provider: (window as any).phantom.solana });
  }
  
  // Check for Solflare
  if ((window as any).solflare?.isSolflare) {
    wallets.push({ name: 'Solflare', provider: (window as any).solflare });
  }
  
  // Check for Backpack
  if ((window as any).backpack?.isBackpack) {
    wallets.push({ name: 'Backpack', provider: (window as any).backpack });
  }
  
  // Check for Glow
  if ((window as any).glow) {
    wallets.push({ name: 'Glow', provider: (window as any).glow });
  }
  
  // Fallback: check for any solana provider
  if (wallets.length === 0 && (window as any).solana) {
    wallets.push({ name: 'Solana Wallet', provider: (window as any).solana });
  }
  
  return wallets;
};

export class SolanaGameManager {
  private connection: Connection;
  private games: Map<string, GameRoom> = new Map();
  private playerStats: Map<string, PlayerStats> = new Map();
  private wallet: any = null;
  private isClient: boolean = false;

  constructor() {
    // Use your QuickNode RPC endpoint as primary
    this.connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
    this.isClient = typeof window !== 'undefined';
    
    console.log('Solana connection initialized with QuickNode RPC:', RPC_ENDPOINTS[0]);
    
    if (this.isClient) {
      this.loadFromStorage();
    }
  }

  async getAvailableWallets() {
    return detectWallets();
  }

  async connectWallet(preferredWallet?: string): Promise<WalletState> {
    if (!this.isClient) {
      throw new Error('Wallet connection only available in browser');
    }

    try {
      const availableWallets = detectWallets();
      
      if (availableWallets.length === 0) {
        throw new Error('No Solana wallet detected. Please install Phantom, Solflare, or another supported wallet.');
      }
      
      let selectedWallet;
      
      if (preferredWallet) {
        selectedWallet = availableWallets.find(w => 
          w.name.toLowerCase().includes(preferredWallet.toLowerCase())
        );
      }
      
      // If no preferred wallet or not found, use the first available
      if (!selectedWallet) {
        selectedWallet = availableWallets[0];
      }
      
      const provider = selectedWallet.provider;
      
      // Connect to the wallet
      const response = await provider.connect();
      this.wallet = provider;
      
      const publicKey = response.publicKey || provider.publicKey;
      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      // Get balance with enhanced retry logic using QuickNode
      const balance = await this.getBalanceWithRetry(publicKey.toString());
      console.log(`Wallet connected: ${publicKey.toString()}, Balance: ${balance} SOL`);
      
      return {
        connected: true,
        publicKey: publicKey.toString(),
        balance
      };
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      if (error.code === 4001) {
        throw new Error('Wallet connection was rejected by user');
      }
      
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }

  // Enhanced balance fetching with QuickNode RPC and fallbacks
  private async getBalanceWithRetry(publicKey: string, maxRetries: number = 3): Promise<number> {
    console.log(`Fetching balance for ${publicKey} using QuickNode RPC...`);
    
    for (let rpcIndex = 0; rpcIndex < RPC_ENDPOINTS.length; rpcIndex++) {
      const rpcUrl = RPC_ENDPOINTS[rpcIndex];
      const connection = new Connection(rpcUrl, 'confirmed');
      
      console.log(`Trying RPC endpoint ${rpcIndex + 1}: ${rpcUrl}`);
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const pubKey = new PublicKey(publicKey);
          const balance = await connection.getBalance(pubKey);
          const solBalance = balance / LAMPORTS_PER_SOL;
          
          console.log(`✅ Balance fetch successful with RPC ${rpcIndex + 1}, attempt ${attempt}: ${solBalance} SOL`);
          console.log(`Raw balance: ${balance} lamports`);
          
          return solBalance;
        } catch (error) {
          console.error(`❌ Balance fetch failed with RPC ${rpcIndex + 1}, attempt ${attempt}:`, error);
          
          if (attempt === maxRetries && rpcIndex === RPC_ENDPOINTS.length - 1) {
            console.warn('⚠️ All balance fetch attempts failed, returning 0');
            return 0;
          }
          
          // Wait before retry with exponential backoff
          const delay = 1000 * attempt * (rpcIndex + 1);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return 0;
  }

  // Load data from localStorage with global sharing
  private loadFromStorage() {
    if (!this.isClient) return;

    try {
      // Load games from global storage (visible to all users)
      const gamesData = safeLocalStorage.getItem(GLOBAL_GAMES_KEY);
      if (gamesData) {
        const games = safeJSONParse(gamesData, {});
        this.games = new Map(Object.entries(games));
        console.log(`Loaded ${this.games.size} games from global storage`);
      }

      // Load stats from global storage
      const statsData = safeLocalStorage.getItem(GLOBAL_STATS_KEY);
      if (statsData) {
        const stats = safeJSONParse(statsData, {});
        this.playerStats = new Map(Object.entries(stats));
        console.log(`Loaded stats for ${this.playerStats.size} players`);
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  }

  // Save data to localStorage with global sharing
  private saveToStorage() {
    if (!this.isClient) return;

    try {
      // Save games to global storage (visible to all users)
      const gamesData = Object.fromEntries(this.games);
      const gamesJson = safeJSONStringify(gamesData);
      if (gamesJson) {
        safeLocalStorage.setItem(GLOBAL_GAMES_KEY, gamesJson);
        console.log(`Saved ${this.games.size} games to global storage`);
      }

      // Save stats to global storage
      const statsData = Object.fromEntries(this.playerStats);
      const statsJson = safeJSONStringify(statsData);
      if (statsJson) {
        safeLocalStorage.setItem(GLOBAL_STATS_KEY, statsJson);
        console.log(`Saved stats for ${this.playerStats.size} players`);
      }
      
      // Trigger storage event for cross-tab synchronization
      if (this.isClient && gamesJson) {
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: GLOBAL_GAMES_KEY,
            newValue: gamesJson
          }));
        } catch (error) {
          console.warn('Failed to dispatch storage event:', error);
        }
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  // Get wallet balance with improved error handling using QuickNode
  async getBalance(publicKey: string | PublicKey): Promise<number> {
    try {
      const pubKey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;
      console.log(`Getting balance for ${pubKey.toString()} using QuickNode...`);
      
      const balance = await this.connection.getBalance(pubKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`✅ Balance retrieved: ${solBalance} SOL (${balance} lamports)`);
      return solBalance;
    } catch (error) {
      console.error('❌ Error getting balance with primary connection:', error);
      
      // Try with retry logic using all RPC endpoints
      if (typeof publicKey === 'string') {
        return await this.getBalanceWithRetry(publicKey);
      } else {
        return await this.getBalanceWithRetry(publicKey.toString());
      }
    }
  }

  // Record bot game result (no SOL involved)
  async recordBotGameResult(playerPublicKey: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
    try {
      console.log(`Recording bot game result: ${result} for player ${playerPublicKey}`);
      
      // Update player stats for bot games
      this.updatePlayerStats(playerPublicKey, result, 0); // 0 entrance fee for bot games
      this.saveToStorage();
      
      console.log(`✅ Bot game result recorded successfully`);
    } catch (error) {
      console.error('❌ Error recording bot game result:', error);
    }
  }

  // Create a new game with enhanced visibility
  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    try {
      console.log(`Creating game for ${creatorPublicKey} with entrance fee ${entranceFee} SOL`);
      
      // Check balance using QuickNode
      const balance = await this.getBalance(creatorPublicKey);
      console.log(`Creator balance: ${balance} SOL, Required: ${entranceFee} SOL`);
      
      if (balance < entranceFee) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${entranceFee} SOL`);
      }

      // Process payment
      await this.processPayment(creatorPublicKey, entranceFee);

      // Create game room with unique ID
      const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const gameRoom: GameRoom = {
        id: gameId,
        creator: creatorPublicKey,
        opponent: null,
        entranceFee,
        status: 'waiting',
        winner: null,
        createdAt: Date.now()
      };

      // Add to games map
      this.games.set(gameId, gameRoom);
      
      // Save to global storage immediately
      this.saveToStorage();
      
      console.log(`✅ Created game ${gameId} with entrance fee ${entranceFee} SOL`);
      console.log(`Total games in storage: ${this.games.size}`);

      return gameRoom;
    } catch (error: any) {
      console.error('❌ Error creating game:', error);
      throw new Error(error.message || 'Failed to create game');
    }
  }

  // Join an existing game
  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    try {
      console.log(`Player ${playerPublicKey} attempting to join game ${gameId}`);
      
      // Reload from storage to get latest games
      this.loadFromStorage();
      
      const game = this.games.get(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      if (game.status !== 'waiting') {
        throw new Error('Game is not available');
      }

      if (game.creator === playerPublicKey) {
        throw new Error('Cannot join your own game');
      }

      // Check balance using QuickNode
      const balance = await this.getBalance(playerPublicKey);
      console.log(`Player balance: ${balance} SOL, Required: ${game.entranceFee} SOL`);
      
      if (balance < game.entranceFee) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${game.entranceFee} SOL`);
      }

      // Process payment
      await this.processPayment(playerPublicKey, game.entranceFee);

      // Update game
      game.opponent = playerPublicKey;
      game.status = 'active';

      this.games.set(gameId, game);
      this.saveToStorage();

      console.log(`✅ Player ${playerPublicKey} joined game ${gameId}`);

      return game;
    } catch (error: any) {
      console.error('❌ Error joining game:', error);
      throw new Error(error.message || 'Failed to join game');
    }
  }

  // Process SOL payment using QuickNode
  private async processPayment(fromPublicKey: string, amount: number): Promise<string> {
    try {
      console.log(`Processing payment: ${amount} SOL from ${fromPublicKey}`);
      
      if (!this.wallet || !this.wallet.isConnected) {
        throw new Error('Wallet not connected');
      }

      const fromPubkey = new PublicKey(fromPublicKey);
      const toPubkey = new PublicKey(TREASURY_WALLET);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      console.log(`Transfer details: ${lamports} lamports to ${TREASURY_WALLET}`);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      // Get recent blockhash using QuickNode
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log('Transaction prepared, requesting signature...');

      // Sign and send transaction
      const signedTransaction = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('Transaction sent, confirming...');
      
      // Confirm transaction
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Payment successful:', signature);
      return signature;
    } catch (error: any) {
      console.error('❌ Payment failed:', error);
      throw new Error('Payment failed: ' + error.message);
    }
  }

  // Complete a game
  async completeGame(gameId: string, winnerPublicKey: string, result: 'win' | 'loss' | 'draw' = 'win'): Promise<void> {
    try {
      const game = this.games.get(gameId);
      if (!game || game.status !== 'active') {
        return;
      }

      game.status = 'completed';
      game.winner = result === 'draw' ? 'draw' : winnerPublicKey;

      // Update player stats
      if (game.creator && game.opponent) {
        this.updatePlayerStats(game.creator, result === 'win' && winnerPublicKey === game.creator ? 'win' : result === 'draw' ? 'draw' : 'loss', game.entranceFee);
        this.updatePlayerStats(game.opponent, result === 'win' && winnerPublicKey === game.opponent ? 'win' : result === 'draw' ? 'draw' : 'loss', game.entranceFee);
      }

      // Process winnings (90% to winner, 10% platform fee)
      if (result !== 'draw' && winnerPublicKey) {
        const winnings = game.entranceFee * 2 * 0.9; // 90% of total pot
        await this.sendWinnings(winnerPublicKey, winnings);
      }

      this.games.set(gameId, game);
      this.saveToStorage();
      
      console.log(`✅ Game ${gameId} completed. Winner: ${winnerPublicKey}, Result: ${result}`);
    } catch (error) {
      console.error('❌ Error completing game:', error);
    }
  }

  // Send winnings to winner
  private async sendWinnings(winnerPublicKey: string, amount: number): Promise<void> {
    try {
      // In a real implementation, this would be handled by a backend service
      // For now, we'll just log the transaction
      console.log(`💰 Sending ${amount} SOL to winner: ${winnerPublicKey}`);
      
      // Update local stats
      const stats = this.playerStats.get(winnerPublicKey) || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalEarnings: 0,
        totalSpent: 0
      };
      
      stats.totalEarnings += amount;
      this.playerStats.set(winnerPublicKey, stats);
      this.saveToStorage();
      
      console.log(`✅ Winnings recorded for ${winnerPublicKey}: ${amount} SOL`);
    } catch (error) {
      console.error('❌ Error sending winnings:', error);
    }
  }

  // Update player statistics (works for both multiplayer and bot games)
  private updatePlayerStats(publicKey: string, result: 'win' | 'loss' | 'draw', entranceFee: number) {
    const stats = this.playerStats.get(publicKey) || {
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalEarnings: 0,
      totalSpent: 0
    };

    stats.totalGames++;
    if (result === 'win') {
      stats.wins++;
    } else if (result === 'loss') {
      stats.losses++;
    } else if (result === 'draw') {
      stats.draws++;
    }

    // Track spending (entrance fees)
    if (entranceFee > 0) {
      stats.totalSpent += entranceFee;
    }

    this.playerStats.set(publicKey, stats);
    console.log(`📊 Updated stats for ${publicKey}:`, stats);
  }

  // Get available games with forced reload
  async getAvailableGames(): Promise<GameRoom[]> {
    // Always reload from storage to get latest games from all users
    this.loadFromStorage();
    
    const availableGames = Array.from(this.games.values())
      .filter(game => game.status === 'waiting')
      .sort((a, b) => b.createdAt - a.createdAt);
    
    console.log(`🎮 Found ${availableGames.length} available games out of ${this.games.size} total games`);
    
    return availableGames;
  }

  // Get player statistics
  getPlayerStats(publicKey: string): PlayerStats | null {
    const stats = this.playerStats.get(publicKey);
    if (stats) {
      console.log(`📊 Retrieved stats for ${publicKey}:`, stats);
    }
    return stats || null;
  }

  // Get game by ID
  getGame(gameId: string): GameRoom | null {
    return this.games.get(gameId) || null;
  }

  // Clean up old games
  cleanupOldGames() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [gameId, game] of this.games.entries()) {
      if (game.status === 'waiting' && now - game.createdAt > oneHour) {
        this.games.delete(gameId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old games`);
      this.saveToStorage();
    }
  }
}
