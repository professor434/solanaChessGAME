// Comprehensive ranking and tournament system
import { safeLocalStorage, safeJSONParse, safeJSONStringify } from './storage-utils';

export interface PlayerRank {
  publicKey: string;
  username?: string;
  currentRank: string;
  elo: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  totalEarnings: number;
  totalSpent: number;
  rankProgress: number; // 0-100 progress to next rank
  achievements: string[];
  joinDate: number;
  lastActive: number;
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

export class RankingSystem {
  private static instance: RankingSystem;
  private readonly STORAGE_KEY = 'solana_chess_rankings';
  private readonly TOURNAMENT_KEY = 'solana_chess_tournaments';

  static getInstance(): RankingSystem {
    if (!RankingSystem.instance) {
      RankingSystem.instance = new RankingSystem();
    }
    return RankingSystem.instance;
  }

  private getCurrentYear(): number {
    return new Date().getFullYear();
  }

  private calculateEloChange(playerElo: number, opponentElo: number, result: 'win' | 'loss' | 'draw'): number {
    const K = 32; // K-factor
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    
    let actualScore = 0;
    if (result === 'win') actualScore = 1;
    else if (result === 'draw') actualScore = 0.5;
    else actualScore = 0;

    return Math.round(K * (actualScore - expectedScore));
  }

  private getRankFromElo(elo: number, gamesPlayed: number): string {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      const rank = RANKS[i];
      if (elo >= rank.minElo && gamesPlayed >= rank.gamesRequired) {
        return rank.name;
      }
    }
    return RANKS[0].name; // Default to Pawn
  }

  private calculateRankProgress(elo: number, gamesPlayed: number): number {
    const currentRank = this.getRankFromElo(elo, gamesPlayed);
    const rankIndex = RANKS.findIndex(r => r.name === currentRank);
    
    if (rankIndex === RANKS.length - 1) return 100; // Max rank
    
    const nextRank = RANKS[rankIndex + 1];
    const currentRankData = RANKS[rankIndex];
    
    // Check if games requirement is met for next rank
    if (gamesPlayed < nextRank.gamesRequired) {
      const gamesProgress = (gamesPlayed / nextRank.gamesRequired) * 50;
      return Math.min(gamesProgress, 50);
    }
    
    // Calculate ELO progress
    const eloProgress = ((elo - currentRankData.minElo) / (nextRank.minElo - currentRankData.minElo)) * 50 + 50;
    return Math.min(eloProgress, 100);
  }

  private checkAchievements(player: PlayerRank): string[] {
    const newAchievements: string[] = [];
    
    // First win
    if (player.wins >= 1 && !player.achievements.includes('first_win')) {
      newAchievements.push('first_win');
    }
    
    // Win streaks
    if (player.bestWinStreak >= 5 && !player.achievements.includes('win_streak_5')) {
      newAchievements.push('win_streak_5');
    }
    if (player.bestWinStreak >= 10 && !player.achievements.includes('win_streak_10')) {
      newAchievements.push('win_streak_10');
    }
    
    // Games played
    if (player.totalGames >= 100 && !player.achievements.includes('games_100')) {
      newAchievements.push('games_100');
    }
    if (player.totalGames >= 500 && !player.achievements.includes('games_500')) {
      newAchievements.push('games_500');
    }
    
    // Earnings
    if (player.totalEarnings >= 1 && !player.achievements.includes('earnings_1')) {
      newAchievements.push('earnings_1');
    }
    if (player.totalEarnings >= 10 && !player.achievements.includes('earnings_10')) {
      newAchievements.push('earnings_10');
    }
    
    return newAchievements;
  }

  getPlayerRank(publicKey: string): PlayerRank {
    const rankings = this.getAllRankings();
    
    if (rankings[publicKey]) {
      return rankings[publicKey];
    }
    
    // Create new player
    const newPlayer: PlayerRank = {
      publicKey,
      currentRank: 'Pawn',
      elo: 1000,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      bestWinStreak: 0,
      totalEarnings: 0,
      totalSpent: 0,
      rankProgress: 0,
      achievements: [],
      joinDate: Date.now(),
      lastActive: Date.now()
    };
    
    this.savePlayerRank(newPlayer);
    return newPlayer;
  }

  updatePlayerAfterGame(
    publicKey: string, 
    result: 'win' | 'loss' | 'draw',
    opponentElo: number = 1000,
    earnings: number = 0,
    spent: number = 0
  ): { player: PlayerRank; newAchievements: string[]; rankUp: boolean } {
    const player = this.getPlayerRank(publicKey);
    const oldRank = player.currentRank;
    
    // Update game stats
    player.totalGames++;
    player.lastActive = Date.now();
    player.totalEarnings += earnings;
    player.totalSpent += spent;
    
    if (result === 'win') {
      player.wins++;
      player.winStreak++;
      player.bestWinStreak = Math.max(player.bestWinStreak, player.winStreak);
    } else if (result === 'loss') {
      player.losses++;
      player.winStreak = 0;
    } else {
      player.draws++;
      player.winStreak = 0;
    }
    
    // Update ELO
    const eloChange = this.calculateEloChange(player.elo, opponentElo, result);
    player.elo = Math.max(0, player.elo + eloChange);
    
    // Update rank
    player.currentRank = this.getRankFromElo(player.elo, player.totalGames);
    player.rankProgress = this.calculateRankProgress(player.elo, player.totalGames);
    
    // Check achievements
    const newAchievements = this.checkAchievements(player);
    player.achievements.push(...newAchievements);
    
    this.savePlayerRank(player);
    
    // Update tournament if active
    this.updateTournamentStats(publicKey, player);
    
    return {
      player,
      newAchievements,
      rankUp: oldRank !== player.currentRank
    };
  }

  private getAllRankings(): Record<string, PlayerRank> {
    const data = safeLocalStorage.getItem(this.STORAGE_KEY);
    return data ? safeJSONParse(data, {}) : {};
  }

  private savePlayerRank(player: PlayerRank): void {
    const rankings = this.getAllRankings();
    rankings[player.publicKey] = player;
    const data = safeJSONStringify(rankings);
    if (data) {
      safeLocalStorage.setItem(this.STORAGE_KEY, data);
    }
  }

  getLeaderboard(limit: number = 100): PlayerRank[] {
    const rankings = this.getAllRankings();
    return Object.values(rankings)
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  }

  // Tournament System
  getCurrentTournament(): AnnualTournament | null {
    const tournaments = this.getAllTournaments();
    const currentYear = this.getCurrentYear();
    return tournaments[currentYear] || null;
  }

  initializeAnnualTournament(): AnnualTournament {
    const currentYear = this.getCurrentYear();
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
    
    this.saveTournament(tournament);
    return tournament;
  }

  private updateTournamentStats(publicKey: string, player: PlayerRank): void {
    let tournament = this.getCurrentTournament();
    if (!tournament) {
      tournament = this.initializeAnnualTournament();
    }
    
    const participantIndex = tournament.participants.findIndex(p => p.publicKey === publicKey);
    
    if (participantIndex >= 0) {
      // Update existing participant
      tournament.participants[participantIndex] = {
        publicKey,
        username: player.username,
        finalElo: player.elo,
        totalWins: player.wins,
        totalEarnings: player.totalEarnings,
        rank: 0 // Will be calculated when tournament ends
      };
    } else {
      // Add new participant
      tournament.participants.push({
        publicKey,
        username: player.username,
        finalElo: player.elo,
        totalWins: player.wins,
        totalEarnings: player.totalEarnings,
        rank: 0
      });
    }
    
    this.saveTournament(tournament);
  }

  finalizeTournament(year: number): AnnualTournament | null {
    const tournaments = this.getAllTournaments();
    const tournament = tournaments[year];
    
    if (!tournament) return null;
    
    // Sort participants by ELO, then by wins, then by earnings
    tournament.participants.sort((a, b) => {
      if (b.finalElo !== a.finalElo) return b.finalElo - a.finalElo;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return b.totalEarnings - a.totalEarnings;
    });
    
    // Assign ranks and mystery prizes
    tournament.participants.forEach((participant, index) => {
      participant.rank = index + 1;
      
      if (index === 0) {
        participant.mysteryPrizeWon = tournament.mysteryPrizes.first;
        // Award achievement
        const player = this.getPlayerRank(participant.publicKey);
        if (!player.achievements.includes('tournament_winner')) {
          player.achievements.push('tournament_winner');
          this.savePlayerRank(player);
        }
      } else if (index === 1) {
        participant.mysteryPrizeWon = tournament.mysteryPrizes.second;
      } else if (index === 2) {
        participant.mysteryPrizeWon = tournament.mysteryPrizes.third;
      }
      
      // Award mystery prize achievement
      if (participant.mysteryPrizeWon) {
        const player = this.getPlayerRank(participant.publicKey);
        if (!player.achievements.includes('mystery_prize')) {
          player.achievements.push('mystery_prize');
          this.savePlayerRank(player);
        }
      }
    });
    
    tournament.isActive = false;
    this.saveTournament(tournament);
    
    return tournament;
  }

  private getAllTournaments(): Record<number, AnnualTournament> {
    const data = safeLocalStorage.getItem(this.TOURNAMENT_KEY);
    return data ? safeJSONParse(data, {}) : {};
  }

  private saveTournament(tournament: AnnualTournament): void {
    const tournaments = this.getAllTournaments();
    tournaments[tournament.year] = tournament;
    const data = safeJSONStringify(tournaments);
    if (data) {
      safeLocalStorage.setItem(this.TOURNAMENT_KEY, data);
    }
  }

  getTournamentHistory(): AnnualTournament[] {
    const tournaments = this.getAllTournaments();
    return Object.values(tournaments).sort((a, b) => b.year - a.year);
  }

  getRankColor(rankName: string): string {
    const rank = RANKS.find(r => r.name === rankName);
    return rank?.color || '#8B4513';
  }

  getAchievementInfo(achievementId: string) {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
  }
}

export const rankingSystem = RankingSystem.getInstance();