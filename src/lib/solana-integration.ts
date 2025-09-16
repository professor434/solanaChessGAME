import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
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
  creatorSigned: boolean;
  opponentSigned: boolean;
  escrowAddress?: string;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalEarnings: number;
}

export class SolanaGameManager {
  private connection: Connection;
  private readonly GAMES_STORAGE_KEY = 'solana_chess_games_global';
  private readonly STATS_STORAGE_KEY = 'solana_chess_stats_global';
  private readonly PLATFORM_WALLET = '42SoggCv1oXBhNWicmAJir3arYiS2NCMveWpUkixYXzj'; // Your real platform wallet
  private readonly QUICKNODE_RPC = 'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f/';

  constructor() {
    // Using your real QuickNode RPC endpoint
    this.connection = new Connection(
      this.QUICKNODE_RPC,
      {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      }
    );
    console.log('🔗 Connected to QuickNode RPC:', this.QUICKNODE_RPC);
    console.log('💰 Platform wallet:', this.PLATFORM_WALLET);
  }

  async getBalance(publicKeyString: string): Promise<number> {
    try {
      console.log(`💰 Getting balance for ${publicKeyString} using QuickNode...`);
      const publicKey = new PublicKey(publicKeyString);
      const balance = await this.connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      console.log(`✅ Balance retrieved: ${solBalance} SOL (${balance} lamports)`);
      return solBalance;
    } catch (error) {
      console.error('❌ Error getting balance:', error);
      return 0;
    }
  }

  private getAllGames(): GameRoom[] {
    try {
      const gamesData = safeLocalStorage.getItem(this.GAMES_STORAGE_KEY);
      const games = gamesData ? safeJSONParse(gamesData, []) : [];
      
      // Filter out old games (older than 24 hours) to keep storage clean
      const validGames = games.filter((game: GameRoom) => 
        Date.now() - game.createdAt < 24 * 60 * 60 * 1000
      );
      
      if (validGames.length !== games.length) {
        this.saveGames(validGames);
      }
      
      console.log(`📱 Loaded ${validGames.length} games from cross-platform storage`);
      return validGames;
    } catch (error) {
      console.error('Error loading games:', error);
      return [];
    }
  }

  private saveGames(games: GameRoom[]): void {
    try {
      const gamesData = safeJSONStringify(games);
      if (gamesData) {
        safeLocalStorage.setItem(this.GAMES_STORAGE_KEY, gamesData);
        console.log(`💾 Saved ${games.length} games to cross-platform storage`);
      }
    } catch (error) {
      console.error('Error saving games:', error);
    }
  }

  async getAvailableGames(): Promise<GameRoom[]> {
    try {
      const allGames = this.getAllGames();
      const availableGames = allGames.filter(game => 
        game.status === 'waiting' && 
        Date.now() - game.createdAt < 2 * 60 * 60 * 1000 // 2 hours max
      );
      console.log(`🎮 Found ${availableGames.length} available games`);
      return availableGames;
    } catch (error) {
      console.error('Error getting available games:', error);
      return [];
    }
  }

  private async createEscrowTransaction(playerPublicKey: string, amount: number): Promise<string> {
    try {
      console.log(`📝 Creating REAL escrow transaction: ${amount} SOL from ${playerPublicKey} to ${this.PLATFORM_WALLET}`);
      
      const connectedWallet = walletManager.getConnectedWallet();
      if (!connectedWallet) {
        throw new Error('Wallet not connected');
      }

      const fromPubkey = new PublicKey(playerPublicKey);
      const toPubkey = new PublicKey(this.PLATFORM_WALLET);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      console.log(`💸 Transfer details: ${lamports} lamports (${amount} SOL)`);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log(`🔗 Transaction created with blockhash: ${blockhash}`);
      
      // Sign transaction with wallet
      const signedTransaction = await connectedWallet.provider.signTransaction(transaction);
      console.log(`✍️ Transaction signed by wallet`);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );
      
      console.log(`📡 Transaction sent with signature: ${signature}`);
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(
        signature,
        'confirmed'
      );
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log(`✅ REAL escrow transaction confirmed: ${signature}`);
      return signature;
    } catch (error) {
      console.error('❌ Real escrow transaction failed:', error);
      throw new Error(`Failed to process SOL payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createGameWithWallet(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    console.log(`🎮 Creating game with REAL SOL payment: ${entranceFee} SOL from ${creatorPublicKey}`);
    
    try {
      // Check balance first
      const balance = await this.getBalance(creatorPublicKey);
      console.log(`💰 Creator balance: ${balance} SOL, Required: ${entranceFee} SOL`);
      
      if (balance < entranceFee + 0.001) { // Add small buffer for transaction fees
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${(entranceFee + 0.001).toFixed(4)} SOL (including fees)`);
      }

      // Create REAL escrow transaction
      console.log(`📝 Processing REAL SOL payment...`);
      const escrowSignature = await this.createEscrowTransaction(creatorPublicKey, entranceFee);

      const gameRoom: GameRoom = {
        id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator: creatorPublicKey,
        opponent: null,
        entranceFee,
        status: 'waiting',
        winner: null,
        createdAt: Date.now(),
        creatorSigned: true,
        opponentSigned: false,
        escrowAddress: escrowSignature
      };

      const allGames = this.getAllGames();
      allGames.push(gameRoom);
      this.saveGames(allGames);

      console.log(`✅ Game created with REAL SOL payment: ${gameRoom.id}`);
      console.log(`💳 Escrow transaction: ${escrowSignature}`);
      return gameRoom;
    } catch (error: any) {
      console.error('❌ Error creating game with real payment:', error);
      throw new Error(error.message || 'Failed to create game with SOL payment');
    }
  }

  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    return this.createGameWithWallet(creatorPublicKey, entranceFee);
  }

  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    console.log(`🎮 Player joining game with REAL SOL payment: ${gameId}`);
    
    try {
      const allGames = this.getAllGames();
      const gameIndex = allGames.findIndex(game => game.id === gameId);
      
      if (gameIndex === -1) {
        throw new Error('Game not found');
      }

      const game = allGames[gameIndex];
      
      if (game.status !== 'waiting') {
        throw new Error('Game is not available for joining');
      }

      if (game.creator === playerPublicKey) {
        throw new Error('Cannot join your own game');
      }

      // Check balance
      const balance = await this.getBalance(playerPublicKey);
      if (balance < game.entranceFee + 0.001) { // Add buffer for fees
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${(game.entranceFee + 0.001).toFixed(4)} SOL (including fees)`);
      }

      // Create REAL escrow transaction for opponent
      console.log(`📝 Processing opponent's REAL SOL payment...`);
      const opponentEscrowSignature = await this.createEscrowTransaction(playerPublicKey, game.entranceFee);

      // Update game
      game.opponent = playerPublicKey;
      game.status = 'active';
      game.opponentSigned = true;
      
      allGames[gameIndex] = game;
      this.saveGames(allGames);

      console.log(`✅ Player joined with REAL SOL payment: ${gameId}`);
      console.log(`💳 Opponent escrow transaction: ${opponentEscrowSignature}`);
      return game;
    } catch (error: any) {
      console.error('❌ Error joining game with real payment:', error);
      throw new Error(error.message || 'Failed to join game with SOL payment');
    }
  }

  async processPayment(fromPublicKey: string, amount: number): Promise<boolean> {
    console.log(`💳 Processing REAL SOL payment: ${amount} SOL from ${fromPublicKey}`);
    
    try {
      const signature = await this.createEscrowTransaction(fromPublicKey, amount);
      console.log(`✅ REAL payment processed: ${signature}`);
      return true;
    } catch (error: any) {
      console.error('❌ Real payment failed:', error);
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  getPlayerStats(publicKey: string): PlayerStats {
    try {
      const statsData = safeLocalStorage.getItem(this.STATS_STORAGE_KEY);
      const allStats = statsData ? safeJSONParse(statsData, {}) : {};
      
      return allStats[publicKey] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalEarnings: 0
      };
    } catch (error) {
      console.error('Error loading player stats:', error);
      return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalEarnings: 0
      };
    }
  }

  updatePlayerStats(publicKey: string, gameResult: 'win' | 'loss' | 'draw', earnings: number = 0): void {
    try {
      const statsData = safeLocalStorage.getItem(this.STATS_STORAGE_KEY);
      const allStats = statsData ? safeJSONParse(statsData, {}) : {};
      
      const currentStats = allStats[publicKey] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalEarnings: 0
      };

      currentStats.totalGames++;
      if (gameResult === 'win') {
        currentStats.wins++;
        currentStats.totalEarnings += earnings;
      } else if (gameResult === 'loss') {
        currentStats.losses++;
      }

      allStats[publicKey] = currentStats;
      
      const updatedStatsData = safeJSONStringify(allStats);
      if (updatedStatsData) {
        safeLocalStorage.setItem(this.STATS_STORAGE_KEY, updatedStatsData);
      }
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  async completeGame(gameId: string, winner: string): Promise<void> {
    try {
      const allGames = this.getAllGames();
      const gameIndex = allGames.findIndex(game => game.id === gameId);
      
      if (gameIndex === -1) {
        throw new Error('Game not found');
      }

      const game = allGames[gameIndex];
      const totalPot = game.entranceFee * 2;
      const winnings = totalPot * 0.9; // 90% to winner, 10% platform fee
      
      game.status = 'completed';
      game.winner = winner;
      
      allGames[gameIndex] = game;
      this.saveGames(allGames);

      // In a real implementation, you would send winnings back to the winner
      // For now, we just log the completion
      console.log(`💰 Game completed - Winner: ${winner} should receive ${winnings} SOL`);
      console.log(`🏦 Platform fee: ${totalPot * 0.1} SOL`);

      // Update stats for both players
      if (game.opponent && game.opponent !== 'bot') {
        this.updatePlayerStats(game.creator, winner === game.creator ? 'win' : 'loss', winner === game.creator ? winnings : 0);
        this.updatePlayerStats(game.opponent, winner === game.opponent ? 'win' : 'loss', winner === game.opponent ? winnings : 0);
      }

      console.log(`✅ Game completed: ${gameId}, Winner: ${winner}, Winnings: ${winnings} SOL`);
    } catch (error) {
      console.error('❌ Error completing game:', error);
    }
  }

  // iOS compatibility methods
  async refreshGamesForMobile(): Promise<GameRoom[]> {
    console.log(`📱 Refreshing games for mobile compatibility...`);
    
    try {
      const games = this.getAllGames();
      
      // Add mobile-specific metadata
      const mobileCompatibleGames = games.map(game => ({
        ...game,
        platform: 'cross-platform',
        lastUpdated: Date.now(),
        mobileCompatible: true
      }));
      
      console.log(`📱 Mobile refresh complete: ${mobileCompatibleGames.length} games`);
      return mobileCompatibleGames;
    } catch (error) {
      console.error('Error refreshing games for mobile:', error);
      return [];
    }
  }

  // Check if game contracts are properly signed
  isGameFullySigned(gameId: string): boolean {
    const games = this.getAllGames();
    const game = games.find(g => g.id === gameId);
    
    if (!game) return false;
    
    const fullySigned = game.creatorSigned && (game.status === 'waiting' || game.opponentSigned);
    console.log(`🔐 Game ${gameId} signing status: Creator(${game.creatorSigned}) Opponent(${game.opponentSigned}) = ${fullySigned}`);
    
    return fullySigned;
  }

  // Get connection info for debugging
  getConnectionInfo(): { rpc: string; platformWallet: string } {
    return {
      rpc: this.QUICKNODE_RPC,
      platformWallet: this.PLATFORM_WALLET
    };
  }
}
