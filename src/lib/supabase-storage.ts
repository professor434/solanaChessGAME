// Simple localStorage-based storage for cross-device game synchronization
interface GameRoom {
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

interface GameResult {
  playerId: string;
  result: 'win' | 'loss' | 'draw';
  earnings: number;
  timestamp: number;
  gameType?: string;
}

class GlobalStorage {
  private storageKey = 'solana_chess_games';
  private resultsKey = 'solana_chess_results';

  async saveGameRoom(gameRoom: GameRoom): Promise<void> {
    try {
      const games = await this.getAllGames();
      const existingIndex = games.findIndex(g => g.id === gameRoom.id);
      
      if (existingIndex >= 0) {
        games[existingIndex] = gameRoom;
      } else {
        games.push(gameRoom);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(games));
      console.log(`💾 Game saved: ${gameRoom.id}`);
    } catch (error) {
      console.error('Error saving game room:', error);
    }
  }

  async getGameRoom(gameId: string): Promise<GameRoom | null> {
    try {
      const games = await this.getAllGames();
      return games.find(g => g.id === gameId) || null;
    } catch (error) {
      console.error('Error getting game room:', error);
      return null;
    }
  }

  async getAllGames(): Promise<GameRoom[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting all games:', error);
      return [];
    }
  }

  async getAvailableGames(): Promise<GameRoom[]> {
    try {
      const games = await this.getAllGames();
      return games.filter(g => g.status === 'waiting');
    } catch (error) {
      console.error('Error getting available games:', error);
      return [];
    }
  }

  async getPlayerGames(playerPublicKey: string): Promise<GameRoom[]> {
    try {
      const games = await this.getAllGames();
      return games.filter(g => 
        g.creator === playerPublicKey || g.opponent === playerPublicKey
      );
    } catch (error) {
      console.error('Error getting player games:', error);
      return [];
    }
  }

  async removeGameRoom(gameId: string): Promise<void> {
    try {
      const games = await this.getAllGames();
      const filteredGames = games.filter(g => g.id !== gameId);
      localStorage.setItem(this.storageKey, JSON.stringify(filteredGames));
      console.log(`🗑️ Game removed: ${gameId}`);
    } catch (error) {
      console.error('Error removing game room:', error);
    }
  }

  async saveGameResult(result: GameResult): Promise<void> {
    try {
      const results = await this.getAllGameResults();
      results.push(result);
      localStorage.setItem(this.resultsKey, JSON.stringify(results));
      console.log(`📊 Result saved for: ${result.playerId}`);
    } catch (error) {
      console.error('Error saving game result:', error);
    }
  }

  async getAllGameResults(): Promise<GameResult[]> {
    try {
      const stored = localStorage.getItem(this.resultsKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting all results:', error);
      return [];
    }
  }

  async getPlayerGameResults(playerPublicKey: string): Promise<GameResult[]> {
    try {
      const results = await this.getAllGameResults();
      return results.filter(r => r.playerId === playerPublicKey);
    } catch (error) {
      console.error('Error getting player results:', error);
      return [];
    }
  }
}

export const globalStorage = new GlobalStorage();