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
  totalPot: number;
  winnerPrize: number;
  platformFee: number;
  status: 'waiting' | 'active' | 'completed';
  winner: string | null;
  createdAt: number;
  creatorPaid: boolean;
  opponentPaid: boolean;
  creatorTxSignature?: string;
  opponentTxSignature?: string;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalEarnings: number;
  totalSpent: number;
}

export class SolanaGameManager {
  private connection: Connection;
  private readonly GAMES_STORAGE_KEY = 'solana_chess_games_global';
  private readonly STATS_STORAGE_KEY = 'solana_chess_stats_global';
  private readonly TREASURY_WALLET = '42SoggCv1oXBhNWicmAJir3arYiS2NCMveWpUkixYXzj';
  private readonly QUICKNODE_RPC = 'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f/';
  private readonly PLATFORM_FEE_PERCENT = 0.10; // 10% platform fee

  constructor() {
    this.connection = new Connection(
      this.QUICKNODE_RPC,
      {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      }
    );
    console.log('🏦 Treasury wallet:', this.TREASURY_WALLET);
    console.log('💰 Platform fee: 10%');
  }

  async getBalance(publicKeyString: string): Promise<number> {
    try {
      console.log(`💰 Getting balance for ${publicKeyString}...`);
      const publicKey = new PublicKey(publicKeyString);
      const balance = await this.connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      console.log(`✅ Balance: ${solBalance} SOL`);
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
      
      const validGames = games.filter((game: GameRoom) => 
        Date.now() - game.createdAt < 24 * 60 * 60 * 1000
      );
      
      if (validGames.length !== games.length) {
        this.saveGames(validGames);
      }
      
      console.log(`📱 Loaded ${validGames.length} games`);
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
        console.log(`💾 Saved ${games.length} games`);
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
        game.creatorPaid &&
        Date.now() - game.createdAt < 2 * 60 * 60 * 1000
      );
      console.log(`🎮 Found ${availableGames.length} available games`);
      return availableGames;
    } catch (error) {
      console.error('Error getting available games:', error);
      return [];
    }
  }

  private async sendToTreasury(playerPublicKey: string, amount: number): Promise<string> {
    try {
      console.log(`💸 Sending ${amount} SOL from ${playerPublicKey} to treasury...`);
      
      const connectedWallet = walletManager.getConnectedWallet();
      if (!connectedWallet) {
        throw new Error('Wallet not connected');
      }

      const fromPubkey = new PublicKey(playerPublicKey);
      const toPubkey = new PublicKey(this.TREASURY_WALLET);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      console.log(`💰 Transfer: ${lamports} lamports (${amount} SOL) to treasury`);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log(`🔗 Transaction created with blockhash: ${blockhash}`);
      
      const signedTransaction = await connectedWallet.provider.signTransaction(transaction);
      console.log(`✍️ Transaction signed`);
      
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );
      
      console.log(`📡 Transaction sent: ${signature}`);
      
      const confirmation = await this.connection.confirmTransaction(
        signature,
        'confirmed'
      );
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log(`✅ Payment to treasury confirmed: ${signature}`);
      return signature;
    } catch (error) {
      console.error('❌ Treasury payment failed:', error);
      throw new Error(`Failed to send SOL to treasury: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createGameWithWallet(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    console.log(`🎮 Creating game - Creator pays ${entranceFee} SOL entrance fee`);
    
    try {
      const balance = await this.getBalance(creatorPublicKey);
      console.log(`💰 Creator balance: ${balance} SOL, Required: ${entranceFee} SOL + fees`);
      
      if (balance < entranceFee + 0.001) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${(entranceFee + 0.001).toFixed(4)} SOL (including fees)`);
      }

      console.log(`💸 Processing creator's entrance fee payment...`);
      const creatorTxSignature = await this.sendToTreasury(creatorPublicKey, entranceFee);

      // Calculate pot distribution
      const totalPot = entranceFee * 2; // Both players pay same amount
      const platformFee = totalPot * this.PLATFORM_FEE_PERCENT; // 10% platform fee
      const winnerPrize = totalPot - platformFee; // 90% to winner

      const gameRoom: GameRoom = {
        id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator: creatorPublicKey,
        opponent: null,
        entranceFee,
        totalPot,
        winnerPrize,
        platformFee,
        status: 'waiting',
        winner: null,
        createdAt: Date.now(),
        creatorPaid: true,
        opponentPaid: false,
        creatorTxSignature
      };

      const allGames = this.getAllGames();
      allGames.push(gameRoom);
      this.saveGames(allGames);

      console.log(`✅ Game created with creator payment:`);
      console.log(`   - Game ID: ${gameRoom.id}`);
      console.log(`   - Entrance Fee: ${entranceFee} SOL (per player)`);
      console.log(`   - Total Pot: ${totalPot} SOL (when both players pay)`);
      console.log(`   - Winner Prize: ${winnerPrize} SOL (90%)`);
      console.log(`   - Platform Fee: ${platformFee} SOL (10%)`);
      console.log(`   - Creator Tx: ${creatorTxSignature}`);
      
      return gameRoom;
    } catch (error: any) {
      console.error('❌ Error creating game:', error);
      throw new Error(error.message || 'Failed to create game');
    }
  }

  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    return this.createGameWithWallet(creatorPublicKey, entranceFee);
  }

  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    console.log(`🎮 Player joining game ${gameId} - Must pay ${gameId} entrance fee`);
    
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

      if (!game.creatorPaid) {
        throw new Error('Game creator has not paid entrance fee');
      }

      // Check opponent's balance
      const balance = await this.getBalance(playerPublicKey);
      if (balance < game.entranceFee + 0.001) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(4)} SOL but need ${(game.entranceFee + 0.001).toFixed(4)} SOL (including fees)`);
      }

      // Opponent must pay same entrance fee
      console.log(`💸 Processing opponent's entrance fee payment...`);
      const opponentTxSignature = await this.sendToTreasury(playerPublicKey, game.entranceFee);

      // Update game with opponent payment
      game.opponent = playerPublicKey;
      game.status = 'active';
      game.opponentPaid = true;
      game.opponentTxSignature = opponentTxSignature;
      
      allGames[gameIndex] = game;
      this.saveGames(allGames);

      console.log(`✅ Player joined game with payment:`);
      console.log(`   - Game ID: ${gameId}`);
      console.log(`   - Opponent: ${playerPublicKey}`);
      console.log(`   - Opponent paid: ${game.entranceFee} SOL`);
      console.log(`   - Total pot now: ${game.totalPot} SOL`);
      console.log(`   - Winner will get: ${game.winnerPrize} SOL (90%)`);
      console.log(`   - Platform keeps: ${game.platformFee} SOL (10%)`);
      console.log(`   - Opponent Tx: ${opponentTxSignature}`);
      
      return game;
    } catch (error: any) {
      console.error('❌ Error joining game:', error);
      throw new Error(error.message || 'Failed to join game');
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
        totalEarnings: 0,
        totalSpent: 0
      };
    } catch (error) {
      console.error('Error loading player stats:', error);
      return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalEarnings: 0,
        totalSpent: 0
      };
    }
  }

  updatePlayerStats(publicKey: string, gameResult: 'win' | 'loss' | 'draw', earnings: number = 0, spent: number = 0): void {
    try {
      const statsData = safeLocalStorage.getItem(this.STATS_STORAGE_KEY);
      const allStats = statsData ? safeJSONParse(statsData, {}) : {};
      
      const currentStats = allStats[publicKey] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalEarnings: 0,
        totalSpent: 0
      };

      currentStats.totalGames++;
      currentStats.totalSpent += spent;
      
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
      
      game.status = 'completed';
      game.winner = winner;
      
      allGames[gameIndex] = game;
      this.saveGames(allGames);

      console.log(`🏆 Game completed:`);
      console.log(`   - Winner: ${winner}`);
      console.log(`   - Winner Prize: ${game.winnerPrize} SOL (90% of ${game.totalPot} SOL pot)`);
      console.log(`   - Platform Fee: ${game.platformFee} SOL (10%)`);
      console.log(`   - Treasury should release ${game.winnerPrize} SOL to winner`);

      // Update stats for both players
      if (game.opponent && game.opponent !== 'bot') {
        this.updatePlayerStats(
          game.creator, 
          winner === game.creator ? 'win' : 'loss', 
          winner === game.creator ? game.winnerPrize : 0,
          game.entranceFee
        );
        this.updatePlayerStats(
          game.opponent, 
          winner === game.opponent ? 'win' : 'loss', 
          winner === game.opponent ? game.winnerPrize : 0,
          game.entranceFee
        );
      }

      console.log(`✅ Game completion recorded with 90/10 split`);
    } catch (error) {
      console.error('❌ Error completing game:', error);
    }
  }

  // iOS compatibility methods
  async refreshGamesForMobile(): Promise<GameRoom[]> {
    console.log(`📱 Refreshing games for mobile...`);
    
    try {
      const games = this.getAllGames();
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

  // Check if game is fully funded (both players paid)
  isGameFullyFunded(gameId: string): boolean {
    const games = this.getAllGames();
    const game = games.find(g => g.id === gameId);
    
    if (!game) return false;
    
    const fullyFunded = game.creatorPaid && game.opponentPaid;
    console.log(`💰 Game ${gameId} funding status: ${fullyFunded ? 'FULLY FUNDED' : 'PARTIALLY FUNDED'}`);
    
    return fullyFunded;
  }

  // Get connection info for debugging
  getConnectionInfo(): { rpc: string; treasuryWallet: string; platformFee: string } {
    return {
      rpc: this.QUICKNODE_RPC,
      treasuryWallet: this.TREASURY_WALLET,
      platformFee: `${this.PLATFORM_FEE_PERCENT * 100}%`
    };
  }
}
