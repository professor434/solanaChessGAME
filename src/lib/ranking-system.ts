import { safeLocalStorage, safeJSONParse, safeJSONStringify } from './storage-utils';

export type Rank = 'Pawn' | 'Knight' | 'Bishop' | 'Rook' | 'Queen' | 'King' | 'Grandmaster' | 'Legend';

export interface PlayerRank {
  publicKey: string;
  username?: string;
  currentRank: Rank;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  totalEarnings: number;
  totalSpent: number;
  rankProgress: number;
  achievements: string[];
  joinedAt: number;
  lastActive: number;
}

export interface AnnualTournament {
  year: number;
  startDate: number;
  endDate: number;
  participants: TournamentEntry[];
  mysteryPrizes: {
    first: string;
    second: string;
    third: string;
  };
  isActive: boolean;
}

export interface TournamentEntry {
  publicKey: string;
  username?: string;
  finalElo: number;
  totalWins: number;
  totalEarnings: number;
  rank: number;
  mysteryPrizeWon?: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  prizePool: number;
  participants: string[];
  status: 'upcoming' | 'active' | 'completed';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (player: PlayerRank) => boolean;
}

export const RANKS = [
  { name: 'Pawn', minElo: 0, maxElo: 800, color: '#8B4513', gamesRequired: 0 },
  { name: 'Knight', minElo: 801, maxElo: 1000, color: '#CD853F', gamesRequired: 10 },
  { name: 'Bishop', minElo: 1001, maxElo: 1200, color: '#32CD32', gamesRequired: 25 },
  { name: 'Rook', minElo: 1201, maxElo: 1400, color: '#4169E1', gamesRequired: 50 },
  { name: 'Queen', minElo: 1401, maxElo: 1600, color: '#9932CC', gamesRequired: 100 },
  { name: 'King', minElo: 1601, maxElo: 1800, color: '#FFD700', gamesRequired: 200 },
  { name: 'Grandmaster', minElo: 1801, maxElo: 2000, color: '#FF4500', gamesRequired: 500 },
  { name: 'Legend', minElo: 2001, maxElo: 9999, color: '#FF1493', gamesRequired: 1000 }
];

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆' },
  { id: 'win_streak_5', name: 'Hot Streak', description: 'Win 5 games in a row', icon: '🔥' },
  { id: 'win_streak_10', name: 'Unstoppable', description: 'Win 10 games in a row', icon: '⚡' },
  { id: 'games_100', name: 'Veteran', description: 'Play 100 games', icon: '🎖️' },
  { id: 'games_500', name: 'Master', description: 'Play 500 games', icon: '👑' },
  { id: 'earnings_1', name: 'First Earnings', description: 'Earn your first SOL', icon: '💰' },
  { id: 'earnings_10', name: 'Big Winner', description: 'Earn 10+ SOL total', icon: '💎' },
  { id: 'bot_slayer', name: 'Bot Slayer', description: 'Beat all bot difficulties', icon: '🤖' },
  { id: 'tournament_winner', name: 'Champion', description: 'Win annual tournament', icon: '🥇' },
  { id: 'mystery_prize', name: 'Lucky Winner', description: 'Win a mystery prize', icon: '🎁' }
];

export const MYSTERY_PRIZES = [
  'Exclusive NFT Chess Set',
  'Custom Chess Board Skin',
  'VIP Tournament Entry',
  'Double XP Boost (30 days)',
  'Rare Avatar Frame',
  'Premium Chess Pieces',
  'Golden Crown Badge',
  'Special Title: "The Chosen"',
  'Bonus SOL Reward',
  'Early Access to New Features'
];

class RankingSystem {
  private readonly RANKINGS_STORAGE_KEY = 'solana_chess_rankings_global';
  private readonly TOURNAMENTS_STORAGE_KEY = 'solana_chess_tournaments_global';
  private readonly LEADERBOARD_STORAGE_KEY = 'solana_chess_leaderboard_global';

  private achievements: Achievement[] = [
    {
      id: 'first_win',
      name: 'First Victory',
      description: 'Win your first game',
      icon: '🎉',
      condition: (player) => player.wins >= 1
    },
    {
      id: 'win_streak_3',
      name: 'Triple Threat',
      description: 'Win 3 games in a row',
      icon: '🔥',
      condition: (player) => player.winStreak >= 3
    },
    {
      id: 'win_streak_5',
      name: 'Unstoppable',
      description: 'Win 5 games in a row',
      icon: '⚡',
      condition: (player) => player.winStreak >= 5
    },
    {
      id: 'win_streak_10',
      name: 'Legendary',
      description: 'Win 10 games in a row',
      icon: '👑',
      condition: (player) => player.winStreak >= 10
    },
    {
      id: 'games_10',
      name: 'Veteran',
      description: 'Play 10 games',
      icon: '🛡️',
      condition: (player) => player.gamesPlayed >= 10
    },
    {
      id: 'games_50',
      name: 'Master',
      description: 'Play 50 games',
      icon: '🏆',
      condition: (player) => player.gamesPlayed >= 50
    },
    {
      id: 'games_100',
      name: 'Grandmaster',
      description: 'Play 100 games',
      icon: '💎',
      condition: (player) => player.gamesPlayed >= 100
    },
    {
      id: 'earnings_1',
      name: 'First Earnings',
      description: 'Earn your first SOL',
      icon: '💰',
      condition: (player) => player.totalEarnings > 0
    },
    {
      id: 'high_elo',
      name: 'Elite Player',
      description: 'Reach 1600+ ELO',
      icon: '⭐',
      condition: (player) => player.elo >= 1600
    }
  ];

  private rankThresholds = {
    'Pawn': 0,
    'Knight': 1200,
    'Bishop': 1400,
    'Rook': 1600,
    'Queen': 1800,
    'King': 2000,
    'Grandmaster': 2200,
    'Legend': 2500
  };

  private rankColors = {
    'Pawn': '#8B4513',
    'Knight': '#CD853F',
    'Bishop': '#4682B4',
    'Rook': '#9932CC',
    'Queen': '#FF1493',
    'King': '#FFD700',
    'Grandmaster': '#FF4500',
    'Legend': '#FF1493'
  };

  // Get all players from global storage
  private getAllPlayers(): PlayerRank[] {
    try {
      const rankingsData = safeLocalStorage.getItem(this.RANKINGS_STORAGE_KEY);
      const rankings = rankingsData ? safeJSONParse(rankingsData, {}) : {};
      
      // Convert object to array and sort by ELO
      const players = Object.values(rankings) as PlayerRank[];
      return players.sort((a, b) => b.elo - a.elo);
    } catch (error) {
      console.error('Error loading all players:', error);
      return [];
    }
  }

  // Save all players to global storage
  private saveAllPlayers(players: PlayerRank[]): void {
    try {
      const rankings: Record<string, PlayerRank> = {};
      players.forEach(player => {
        rankings[player.publicKey] = player;
      });
      
      const rankingsData = safeJSONStringify(rankings);
      if (rankingsData) {
        safeLocalStorage.setItem(this.RANKINGS_STORAGE_KEY, rankingsData);
        
        // Also update leaderboard cache
        this.updateLeaderboardCache(players);
        console.log(`💾 Saved ${players.length} players to global rankings`);
      }
    } catch (error) {
      console.error('Error saving all players:', error);
    }
  }

  // Update leaderboard cache for faster access
  private updateLeaderboardCache(players: PlayerRank[]): void {
    try {
      const leaderboard = players
        .filter(p => p.gamesPlayed > 0)
        .sort((a, b) => b.elo - a.elo)
        .slice(0, 100) // Top 100 players
        .map((player, index) => ({
          rank: index + 1,
          publicKey: player.publicKey,
          currentRank: player.currentRank,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
          winStreak: player.winStreak,
          gamesPlayed: player.gamesPlayed,
          totalEarnings: player.totalEarnings,
          lastActive: player.lastActive
        }));

      const leaderboardData = safeJSONStringify(leaderboard);
      if (leaderboardData) {
        safeLocalStorage.setItem(this.LEADERBOARD_STORAGE_KEY, leaderboardData);
        console.log(`📊 Updated leaderboard cache with ${leaderboard.length} players`);
      }
    } catch (error) {
      console.error('Error updating leaderboard cache:', error);
    }
  }

  getPlayerRank(publicKey: string): PlayerRank {
    try {
      const allPlayers = this.getAllPlayers();
      let player = allPlayers.find(p => p.publicKey === publicKey);
      
      if (!player) {
        // Create new player
        player = {
          publicKey,
          currentRank: 'Pawn',
          elo: 1000,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winStreak: 0,
          bestWinStreak: 0,
          totalEarnings: 0,
          totalSpent: 0,
          rankProgress: 0,
          achievements: [],
          joinedAt: Date.now(),
          lastActive: Date.now()
        };
        
        allPlayers.push(player);
        this.saveAllPlayers(allPlayers);
        console.log(`👤 Created new player: ${publicKey}`);
      } else {
        // Update last active
        player.lastActive = Date.now();
        this.saveAllPlayers(allPlayers);
      }
      
      return player;
    } catch (error) {
      console.error('Error getting player rank:', error);
      return {
        publicKey,
        currentRank: 'Pawn',
        elo: 1000,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        bestWinStreak: 0,
        totalEarnings: 0,
        totalSpent: 0,
        rankProgress: 0,
        achievements: [],
        joinedAt: Date.now(),
        lastActive: Date.now()
      };
    }
  }

  updatePlayerAfterGame(
    publicKey: string, 
    result: 'win' | 'loss' | 'draw', 
    eloChange: number,
    earnings: number = 0,
    spent: number = 0
  ): { player: PlayerRank; newAchievements: string[]; rankUp: boolean } {
    try {
      const allPlayers = this.getAllPlayers();
      let player = allPlayers.find(p => p.publicKey === publicKey);
      
      if (!player) {
        player = this.getPlayerRank(publicKey);
        allPlayers.push(player);
      }

      const oldRank = player.currentRank;
      const newAchievements: string[] = [];

      // Update stats
      player.gamesPlayed++;
      player.lastActive = Date.now();
      
      if (result === 'win') {
        player.wins++;
        player.winStreak++;
        player.elo += Math.abs(eloChange);
        player.totalEarnings += earnings;
        
        if (player.winStreak > player.bestWinStreak) {
          player.bestWinStreak = player.winStreak;
        }
      } else if (result === 'loss') {
        player.losses++;
        player.winStreak = 0;
        player.elo = Math.max(800, player.elo - Math.abs(eloChange)); // Minimum ELO of 800
      } else {
        // Draw - small ELO adjustment
        player.draws++;
        player.winStreak = 0;
        player.elo += eloChange > 0 ? 5 : -5;
      }

      // Update rank based on ELO
      const newRank = this.calculateRank(player.elo);
      const rankUp = newRank !== oldRank && this.getRankLevel(newRank) > this.getRankLevel(oldRank);
      player.currentRank = newRank;

      // Check for new achievements
      this.achievements.forEach(achievement => {
        if (!player!.achievements.includes(achievement.id) && achievement.condition(player!)) {
          player!.achievements.push(achievement.id);
          newAchievements.push(achievement.id);
        }
      });

      // Save updated players
      this.saveAllPlayers(allPlayers);

      console.log(`🎮 Updated player ${publicKey}: ${result} | ELO: ${player.elo} | Rank: ${player.currentRank}`);
      
      return { player, newAchievements, rankUp };
    } catch (error) {
      console.error('Error updating player after game:', error);
      return { 
        player: this.getPlayerRank(publicKey), 
        newAchievements: [], 
        rankUp: false 
      };
    }
  }

  private calculateRank(elo: number): Rank {
    const ranks: Rank[] = ['Legend', 'Grandmaster', 'King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'];
    
    for (const rank of ranks) {
      if (elo >= this.rankThresholds[rank]) {
        return rank;
      }
    }
    
    return 'Pawn';
  }

  private getRankLevel(rank: Rank): number {
    const levels = {
      'Pawn': 1,
      'Knight': 2,
      'Bishop': 3,
      'Rook': 4,
      'Queen': 5,
      'King': 6,
      'Grandmaster': 7,
      'Legend': 8
    };
    return levels[rank];
  }

  getRankColor(rank: Rank): string {
    return this.rankColors[rank];
  }

  getLeaderboard(limit: number = 50): any[] {
    try {
      // Try to get from cache first
      const cachedData = safeLocalStorage.getItem(this.LEADERBOARD_STORAGE_KEY);
      if (cachedData) {
        const cached = safeJSONParse(cachedData, []);
        if (cached.length > 0) {
          return cached.slice(0, limit);
        }
      }

      // Fallback to generating from all players
      const allPlayers = this.getAllPlayers();
      const leaderboard = allPlayers
        .filter(p => p.gamesPlayed > 0)
        .sort((a, b) => b.elo - a.elo)
        .slice(0, limit)
        .map((player, index) => ({
          rank: index + 1,
          publicKey: player.publicKey,
          currentRank: player.currentRank,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
          winStreak: player.winStreak,
          gamesPlayed: player.gamesPlayed,
          totalEarnings: player.totalEarnings,
          lastActive: player.lastActive
        }));

      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  getPlayerRanking(publicKey: string): number {
    try {
      const leaderboard = this.getLeaderboard(1000); // Get more for accurate ranking
      const playerIndex = leaderboard.findIndex(p => p.publicKey === publicKey);
      return playerIndex >= 0 ? playerIndex + 1 : -1;
    } catch (error) {
      console.error('Error getting player ranking:', error);
      return -1;
    }
  }

  getAchievementInfo(achievementId: string): Achievement | null {
    return this.achievements.find(a => a.id === achievementId) || null;
  }

  getAllAchievements(): Achievement[] {
    return this.achievements;
  }

  // Tournament system methods
  getCurrentTournament(): AnnualTournament | null {
    try {
      const tournamentsData = safeLocalStorage.getItem(this.TOURNAMENTS_STORAGE_KEY);
      const tournaments = tournamentsData ? safeJSONParse(tournamentsData, {}) : {};
      
      const currentYear = new Date().getFullYear();
      return tournaments[currentYear] || null;
    } catch (error) {
      console.error('Error getting current tournament:', error);
      return null;
    }
  }

  initializeAnnualTournament(): AnnualTournament {
    try {
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, 0, 1).getTime(); // January 1st
      const endDate = new Date(currentYear, 11, 31, 23, 59, 59).getTime(); // December 31st
      
      const tournament: AnnualTournament = {
        year: currentYear,
        startDate,
        endDate,
        participants: [],
        mysteryPrizes: {
          first: MYSTERY_PRIZES[Math.floor(Math.random() * MYSTERY_PRIZES.length)],
          second: MYSTERY_PRIZES[Math.floor(Math.random() * MYSTERY_PRIZES.length)],
          third: MYSTERY_PRIZES[Math.floor(Math.random() * MYSTERY_PRIZES.length)]
        },
        isActive: true
      };
      
      const tournamentsData = safeLocalStorage.getItem(this.TOURNAMENTS_STORAGE_KEY);
      const tournaments = tournamentsData ? safeJSONParse(tournamentsData, {}) : {};
      tournaments[currentYear] = tournament;
      
      const tournamentsDataStr = safeJSONStringify(tournaments);
      if (tournamentsDataStr) {
        safeLocalStorage.setItem(this.TOURNAMENTS_STORAGE_KEY, tournamentsDataStr);
      }
      
      console.log(`🏆 Initialized ${currentYear} Annual Tournament`);
      return tournament;
    } catch (error) {
      console.error('Error initializing tournament:', error);
      return {
        year: new Date().getFullYear(),
        startDate: Date.now(),
        endDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
        participants: [],
        mysteryPrizes: {
          first: 'Exclusive NFT Chess Set',
          second: 'Custom Chess Board Skin', 
          third: 'VIP Tournament Entry'
        },
        isActive: true
      };
    }
  }

  getTournamentHistory(): AnnualTournament[] {
    try {
      const tournamentsData = safeLocalStorage.getItem(this.TOURNAMENTS_STORAGE_KEY);
      const tournaments = tournamentsData ? safeJSONParse(tournamentsData, {}) : {};
      
      return Object.values(tournaments).sort((a: any, b: any) => b.year - a.year);
    } catch (error) {
      console.error('Error getting tournament history:', error);
      return [];
    }
  }

  // Get global statistics
  getGlobalStats(): {
    totalPlayers: number;
    totalGames: number;
    totalEarnings: number;
    averageElo: number;
    topPlayer: PlayerRank | null;
  } {
    try {
      const allPlayers = this.getAllPlayers();
      const activePlayers = allPlayers.filter(p => p.gamesPlayed > 0);
      
      const totalGames = activePlayers.reduce((sum, p) => sum + p.gamesPlayed, 0) / 2; // Divide by 2 since each game involves 2 players
      const totalEarnings = activePlayers.reduce((sum, p) => sum + p.totalEarnings, 0);
      const averageElo = activePlayers.length > 0 ? 
        activePlayers.reduce((sum, p) => sum + p.elo, 0) / activePlayers.length : 1000;
      
      return {
        totalPlayers: activePlayers.length,
        totalGames: Math.floor(totalGames),
        totalEarnings,
        averageElo: Math.round(averageElo),
        topPlayer: activePlayers.length > 0 ? activePlayers[0] : null
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return {
        totalPlayers: 0,
        totalGames: 0,
        totalEarnings: 0,
        averageElo: 1000,
        topPlayer: null
      };
    }
  }

  // Force sync all data (useful for cross-device compatibility)
  syncGlobalData(): void {
    try {
      const allPlayers = this.getAllPlayers();
      this.saveAllPlayers(allPlayers);
      console.log('🔄 Global data synced successfully');
    } catch (error) {
      console.error('Error syncing global data:', error);
    }
  }
}

export const rankingSystem = new RankingSystem();
