import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { safeLocalStorage, safeJSONParse, safeJSONStringify } from './storage-utils';
import { walletManager } from './wallet-manager';

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

export class SolanaGameManager {
  private connection: Connection;
  private readonly QUICKNODE_RPC = 'https://solana-mainnet.g.alchemy.com/v2/alch-demo';
  private readonly GAMES_STORAGE_KEY = 'solana_chess_games';
  private readonly STATS_STORAGE_KEY = 'solana_chess_stats';
  private walletState: WalletState | null = null;

  constructor() {
    this.connection = new Connection(this.QUICKNODE_RPC, 'confirmed');
  }

  setWalletState(walletState: WalletState) {
    this.walletState = walletState;
  }

  async getBalance(publicKeyString: string): Promise<number> {
    try {
      console.log(`Getting balance for ${publicKeyString} using QuickNode...`);
      const publicKey = new PublicKey(publicKeyString);
      const balance = await this.connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      console.log(`✅ Balance retrieved: ${solBalance} SOL (${balance} lamports)`);
      return solBalance;
    } catch (error) {
      console.error('❌ Error getting balance:', error);
      throw new Error('Failed to get wallet balance');
    }
  }

  private async processPayment(fromPublicKey: string, amount: number): Promise<boolean> {
    try {
      console.log(`Processing payment: ${amount} SOL from ${fromPublicKey}`);
      
      // Check if wallet is connected through wallet manager
      const connectedWallet = walletManager.getConnectedWallet();
      if (!connectedWallet || !this.walletState?.connected) {
        throw new Error('Wallet not connected');
      }

      // For now, we'll simulate the payment since we're using localStorage
      // In a real implementation, you would create and send a transaction
      console.log(`✅ Payment simulated: ${amount} SOL from ${fromPublicKey}`);
      return true;
    } catch (error) {
      console.error('❌ Payment failed:', error);
      throw new Error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    try {
      console.log(`Creating game for ${creatorPublicKey} with entrance fee ${entranceFee} SOL`);
      
      // Check balance
      const balance = await this.getBalance(creatorPublicKey);
      console.log(`Creator balance: ${balance} SOL, Required: ${entranceFee} SOL`);
      
      if (balance < entranceFee) {
        throw new Error('Insufficient balance');
      }

      // Process payment
      await this.processPayment(creatorPublicKey, entranceFee);

      // Create game room
      const gameRoom: GameRoom = {
        id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator: creatorPublicKey,
        opponent: null,
        entranceFee,
        status: 'waiting',
        winner: null,
        createdAt: Date.now()
      };

      // Save to storage
      const games = this.getAllGames();
      games.push(gameRoom);
      this.saveGames(games);

      // Update stats
      this.updatePlayerStats(creatorPublicKey, { totalSpent: entranceFee });

      console.log(`✅ Game created: ${gameRoom.id}`);
      return gameRoom;
    } catch (error) {
      console.error('❌ Error creating game:', error);
      throw error;
    }
  }

  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    try {
      console.log(`Player ${playerPublicKey} joining game ${gameId}`);
      
      const games = this.getAllGames();
      const gameIndex = games.findIndex(g => g.id === gameId);
      
      if (gameIndex === -1) {
        throw new Error('Game not found');
      }

      const game = games[gameIndex];
      
      if (game.status !== 'waiting') {
        throw new Error('Game is not available');
      }

      if (game.creator === playerPublicKey) {
        throw new Error('Cannot join your own game');
      }

      // Check balance
      const balance = await this.getBalance(playerPublicKey);
      if (balance < game.entranceFee) {
        throw new Error('Insufficient balance');
      }

      // Process payment
      await this.processPayment(playerPublicKey, game.entranceFee);

      // Update game
      game.opponent = playerPublicKey;
      game.status = 'active';
      games[gameIndex] = game;
      this.saveGames(games);

      // Update stats
      this.updatePlayerStats(playerPublicKey, { totalSpent: game.entranceFee });

      console.log(`✅ Player joined game: ${gameId}`);
      return game;
    } catch (error) {
      console.error('❌ Error joining game:', error);
      throw error;
    }
  }

  async completeGame(gameId: string, winner: string): Promise<void> {
    try {
      const games = this.getAllGames();
      const gameIndex = games.findIndex(g => g.id === gameId);
      
      if (gameIndex === -1) {
        throw new Error('Game not found');
      }

      const game = games[gameIndex];
      game.status = 'completed';
      game.winner = winner;
      games[gameIndex] = game;
      this.saveGames(games);

      // Calculate winnings (90% of total pot)
      const totalPot = game.entranceFee * 2;
      const winnings = totalPot * 0.9;

      // Update winner stats
      this.updatePlayerStats(winner, { 
        wins: 1, 
        totalGames: 1, 
        totalEarnings: winnings 
      });

      // Update loser stats
      const loser = game.creator === winner ? game.opponent! : game.creator;
      this.updatePlayerStats(loser, { 
        losses: 1, 
        totalGames: 1 
      });

      console.log(`✅ Game completed: ${gameId}, Winner: ${winner}`);
    } catch (error) {
      console.error('❌ Error completing game:', error);
      throw error;
    }
  }

  getAvailableGames(): GameRoom[] {
    try {
      const games = this.getAllGames();
      const availableGames = games.filter(game => 
        game.status === 'waiting' && 
        Date.now() - game.createdAt < 24 * 60 * 60 * 1000 // 24 hours
      );
      
      console.log(`🎮 Found ${availableGames.length} available games out of ${games.length} total games`);
      return availableGames;
    } catch (error) {
      console.error('❌ Error getting available games:', error);
      return [];
    }
  }

  getPlayerStats(publicKey: string): PlayerStats {
    const allStats = this.getAllStats();
    return allStats[publicKey] || {
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalEarnings: 0,
      totalSpent: 0
    };
  }

  private getAllGames(): GameRoom[] {
    try {
      const data = safeLocalStorage.getItem(this.GAMES_STORAGE_KEY);
      const games = data ? safeJSONParse(data, []) : [];
      console.log(`Loaded ${games.length} games from global storage`);
      return games;
    } catch (error) {
      console.error('Error loading games:', error);
      return [];
    }
  }

  private saveGames(games: GameRoom[]): void {
    try {
      const data = safeJSONStringify(games);
      if (data) {
        safeLocalStorage.setItem(this.GAMES_STORAGE_KEY, data);
      }
    } catch (error) {
      console.error('Error saving games:', error);
    }
  }

  private getAllStats(): Record<string, PlayerStats> {
    try {
      const data = safeLocalStorage.getItem(this.STATS_STORAGE_KEY);
      const stats = data ? safeJSONParse(data, {}) : {};
      console.log(`Loaded stats for ${Object.keys(stats).length} players`);
      return stats;
    } catch (error) {
      console.error('Error loading stats:', error);
      return {};
    }
  }

  private updatePlayerStats(publicKey: string, updates: Partial<PlayerStats>): void {
    try {
      const allStats = this.getAllStats();
      const currentStats = allStats[publicKey] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalEarnings: 0,
        totalSpent: 0
      };

      // Apply updates
      Object.keys(updates).forEach(key => {
        const typedKey = key as keyof PlayerStats;
        if (typeof updates[typedKey] === 'number') {
          (currentStats[typedKey] as number) += updates[typedKey] as number;
        }
      });

      allStats[publicKey] = currentStats;
      
      const data = safeJSONStringify(allStats);
      if (data) {
        safeLocalStorage.setItem(this.STATS_STORAGE_KEY, data);
      }
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }
}
