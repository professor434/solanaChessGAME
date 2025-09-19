import { globalStorage } from './supabase-storage';
import { SOLANA_CONFIG } from './solana-config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

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
  lastActivity: number;
  creatorPaid: boolean;
  opponentPaid: boolean;
}

export class SolanaGameManager {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(SOLANA_CONFIG.RPC_URL, {
      commitment: SOLANA_CONFIG.COMMITMENT,
    });
    console.log('🎮 SolanaGameManager initialized with mainnet RPC');
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      console.log(`💰 Getting balance for: ${publicKey}`);
      
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Balance: ${solBalance.toFixed(4)} SOL`);
      return solBalance;
    } catch (error) {
      console.error('❌ Error getting balance:', error);
      return 0;
    }
  }

  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    try {
      // Validate entrance fee
      if (entranceFee < SOLANA_CONFIG.MIN_GAME_AMOUNT || entranceFee > SOLANA_CONFIG.MAX_GAME_AMOUNT) {
        throw new Error(`Entrance fee must be between ${SOLANA_CONFIG.MIN_GAME_AMOUNT} and ${SOLANA_CONFIG.MAX_GAME_AMOUNT} SOL`);
      }

      const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const totalPot = entranceFee * 2;
      const platformFee = totalPot * SOLANA_CONFIG.PLATFORM_FEE_PERCENTAGE;
      const winnerPrize = totalPot * SOLANA_CONFIG.WINNER_PERCENTAGE;
      
      const gameRoom: GameRoom = {
        id: gameId,
        creator: creatorPublicKey,
        opponent: null,
        entranceFee,
        totalPot,
        winnerPrize,
        platformFee,
        status: 'waiting',
        winner: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        creatorPaid: true, // In production, verify actual payment
        opponentPaid: false
      };

      // Store game in global storage
      await globalStorage.saveGameRoom(gameRoom);
      
      console.log('🎮 Game created:', gameId);
      return gameRoom;
    } catch (error) {
      console.error('❌ Error creating game:', error);
      throw new Error('Failed to create game');
    }
  }

  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    try {
      const gameRoom = await globalStorage.getGameRoom(gameId);
      
      if (!gameRoom) {
        throw new Error('Game not found');
      }

      if (gameRoom.opponent !== null) {
        throw new Error('Game is already full');
      }

      if (gameRoom.creator === playerPublicKey) {
        throw new Error('Cannot join your own game');
      }

      if (gameRoom.status !== 'waiting') {
        throw new Error('Game is not available for joining');
      }

      // Update game with opponent
      const updatedGame: GameRoom = {
        ...gameRoom,
        opponent: playerPublicKey,
        opponentPaid: true, // In production, verify actual payment
        lastActivity: Date.now()
      };

      await globalStorage.saveGameRoom(updatedGame);
      
      console.log('🎮 Player joined game:', gameId);
      return updatedGame;
    } catch (error) {
      console.error('❌ Error joining game:', error);
      throw error;
    }
  }

  async getAvailableGames(): Promise<GameRoom[]> {
    try {
      const games = await globalStorage.getAvailableGames();
      
      // Filter out old games (older than 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const activeGames = games.filter(game => 
        game.lastActivity > oneHourAgo && 
        game.status === 'waiting'
      );
      
      console.log(`🎮 Found ${activeGames.length} available games`);
      return activeGames;
    } catch (error) {
      console.error('❌ Error getting available games:', error);
      return [];
    }
  }

  async getPlayerCurrentGame(playerPublicKey: string): Promise<GameRoom | null> {
    try {
      const games = await globalStorage.getPlayerGames(playerPublicKey);
      
      // Find active or waiting game
      const activeGame = games.find(game => 
        game.status === 'waiting' || game.status === 'active'
      );
      
      if (activeGame) {
        console.log(`🎮 Found active game for player: ${activeGame.id}`);
      }
      
      return activeGame || null;
    } catch (error) {
      console.error('❌ Error getting player current game:', error);
      return null;
    }
  }

  async updateGameStatus(gameId: string, status: 'waiting' | 'active' | 'completed'): Promise<void> {
    try {
      const gameRoom = await globalStorage.getGameRoom(gameId);
      
      if (!gameRoom) {
        throw new Error('Game not found');
      }

      const updatedGame: GameRoom = {
        ...gameRoom,
        status,
        lastActivity: Date.now()
      };

      await globalStorage.saveGameRoom(updatedGame);
      
      console.log(`🎮 Game status updated: ${gameId} -> ${status}`);
    } catch (error) {
      console.error('❌ Error updating game status:', error);
      throw error;
    }
  }

  async completeGame(gameId: string, winner: string, result?: 'win' | 'loss' | 'draw'): Promise<void> {
    try {
      const gameRoom = await globalStorage.getGameRoom(gameId);
      
      if (!gameRoom) {
        throw new Error('Game not found');
      }

      const updatedGame: GameRoom = {
        ...gameRoom,
        status: 'completed',
        winner: winner === 'draw' ? 'draw' : winner,
        lastActivity: Date.now()
      };

      await globalStorage.saveGameRoom(updatedGame);
      
      // Record game result for both players
      if (gameRoom.creator && gameRoom.opponent) {
        const creatorResult = winner === gameRoom.creator ? 'win' : 
                            winner === 'draw' ? 'draw' : 'loss';
        const opponentResult = winner === gameRoom.opponent ? 'win' : 
                             winner === 'draw' ? 'draw' : 'loss';
        
        const creatorEarnings = creatorResult === 'win' ? gameRoom.winnerPrize : 0;
        const opponentEarnings = opponentResult === 'win' ? gameRoom.winnerPrize : 0;
        
        await this.recordGameResult(gameRoom.creator, creatorResult, creatorEarnings);
        await this.recordGameResult(gameRoom.opponent, opponentResult, opponentEarnings);
      }
      
      console.log(`🎮 Game completed: ${gameId}, Winner: ${winner}`);
    } catch (error) {
      console.error('❌ Error completing game:', error);
      throw error;
    }
  }

  async cancelGame(gameId: string, playerPublicKey: string): Promise<void> {
    try {
      const gameRoom = await globalStorage.getGameRoom(gameId);
      
      if (!gameRoom) {
        throw new Error('Game not found');
      }

      if (gameRoom.creator !== playerPublicKey) {
        throw new Error('Only game creator can cancel');
      }

      if (gameRoom.opponent !== null) {
        throw new Error('Cannot cancel game with opponent');
      }

      // Remove game from storage
      await globalStorage.removeGameRoom(gameId);
      
      console.log(`🎮 Game cancelled: ${gameId}`);
    } catch (error) {
      console.error('❌ Error cancelling game:', error);
      throw error;
    }
  }

  async recordGameResult(playerPublicKey: string, result: 'win' | 'loss' | 'draw', earnings: number = 0): Promise<void> {
    try {
      const gameResult = {
        playerId: playerPublicKey,
        result,
        earnings,
        timestamp: Date.now()
      };

      await globalStorage.saveGameResult(gameResult);
      
      console.log(`🎮 Game result recorded for ${playerPublicKey}: ${result}`);
    } catch (error) {
      console.error('❌ Error recording game result:', error);
    }
  }

  async recordBotGameResult(playerPublicKey: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
    try {
      const gameResult = {
        playerId: playerPublicKey,
        result,
        earnings: 0, // No earnings from bot games
        timestamp: Date.now(),
        gameType: 'bot'
      };

      await globalStorage.saveGameResult(gameResult);
      
      console.log(`🤖 Bot game result recorded for ${playerPublicKey}: ${result}`);
    } catch (error) {
      console.error('❌ Error recording bot game result:', error);
    }
  }

  async getPlayerStats(playerPublicKey: string): Promise<any> {
    try {
      const results = await globalStorage.getPlayerGameResults(playerPublicKey);
      
      const stats = {
        totalGames: results.length,
        wins: results.filter(r => r.result === 'win').length,
        losses: results.filter(r => r.result === 'loss').length,
        draws: results.filter(r => r.result === 'draw').length,
        totalEarnings: results.reduce((sum, r) => sum + (r.earnings || 0), 0),
        botGames: results.filter(r => r.gameType === 'bot').length,
        multiplayerGames: results.filter(r => r.gameType !== 'bot').length
      };
      
      console.log(`📊 Player stats for ${playerPublicKey}:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error getting player stats:', error);
      return {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalEarnings: 0,
        botGames: 0,
        multiplayerGames: 0
      };
    }
  }

  // Get connection for external use
  getConnection(): Connection {
    return this.connection;
  }

  // Validate wallet address
  isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}
