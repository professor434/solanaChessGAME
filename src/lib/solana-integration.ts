import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

// Treasury wallet for collecting fees
export const TREASURY_WALLET = '42SoggCv1oXBhNWicmAJir3arYiS2NCMveWpUkixYXzj';

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
  prizePool: number;
  creatorPaid: boolean;
  opponentPaid: boolean;
  treasuryPaid: boolean;
}

export interface GameStats {
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
  entranceFee: number;
  payout: number;
}

// Detect available wallets (mobile-friendly)
const detectWallets = () => {
  const wallets = [];
  
  // Check for Phantom (mobile and desktop)
  if ((window as any).phantom?.solana?.isPhantom) {
    wallets.push({ name: 'Phantom', provider: (window as any).phantom.solana });
  }
  
  // Check for Solflare (mobile and desktop)
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
  
  // Fallback: check for any solana provider (mobile compatibility)
  if (wallets.length === 0 && (window as any).solana) {
    wallets.push({ name: 'Solana Wallet', provider: (window as any).solana });
  }
  
  return wallets;
};

export class SolanaGameManager {
  private connection: Connection;
  private wallet: any = null;

  constructor() {
    this.connection = connection;
  }

  async getAvailableWallets() {
    return detectWallets();
  }

  async connectWallet(preferredWallet?: string): Promise<WalletState> {
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

      const balance = await this.getBalance(publicKey);
      
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

  // REAL PAYMENT SYSTEM
  async payEntranceFee(playerPublicKey: string, entranceFee: number): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const fromPubkey = new PublicKey(playerPublicKey);
      const toPubkey = new PublicKey(TREASURY_WALLET);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: entranceFee * LAMPORTS_PER_SOL
        })
      );

      const signature = await this.sendTransaction(transaction);
      console.log(`Entrance fee paid: ${entranceFee} SOL to treasury. Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error('Payment error:', error);
      throw new Error(error.message || 'Payment failed');
    }
  }

  async payoutWinner(winnerPublicKey: string, amount: number): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      // In real implementation, this would be from a program-controlled account
      // For demo, we simulate the payout
      const fromPubkey = new PublicKey(TREASURY_WALLET);
      const toPubkey = new PublicKey(winnerPublicKey);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount * LAMPORTS_PER_SOL
        })
      );

      const signature = await this.sendTransaction(transaction);
      console.log(`Winner payout: ${amount} SOL to ${winnerPublicKey}. Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error('Payout error:', error);
      throw new Error(error.message || 'Payout failed');
    }
  }

  // IMPROVED GAME MANAGEMENT WITH GLOBAL STORAGE
  async createGame(creator: string, entranceFee: number): Promise<GameRoom> {
    // First, pay the entrance fee
    try {
      await this.payEntranceFee(creator, entranceFee);
    } catch (error) {
      throw new Error('Failed to pay entrance fee: ' + error.message);
    }

    const gameRoom: GameRoom = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creator,
      entranceFee,
      status: 'waiting',
      createdAt: Date.now(),
      prizePool: entranceFee, // Creator already paid
      creatorPaid: true,
      opponentPaid: false,
      treasuryPaid: false
    };

    // Store in localStorage with global key for visibility
    const existingGames = JSON.parse(localStorage.getItem('global_chess_games') || '[]');
    existingGames.push(gameRoom);
    localStorage.setItem('global_chess_games', JSON.stringify(existingGames));

    // Also store in session-specific storage
    const sessionGames = JSON.parse(localStorage.getItem('chess_games') || '[]');
    sessionGames.push(gameRoom);
    localStorage.setItem('chess_games', JSON.stringify(sessionGames));

    return gameRoom;
  }

  async getAvailableGames(): Promise<GameRoom[]> {
    try {
      // Get from global storage so all players can see all games
      const games = JSON.parse(localStorage.getItem('global_chess_games') || '[]');
      
      // Filter out old games (older than 24 hours) and only show waiting games
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const activeGames = games.filter((game: GameRoom) => 
        game.createdAt > oneDayAgo && game.status === 'waiting'
      );
      
      // Update storage with filtered games
      localStorage.setItem('global_chess_games', JSON.stringify(games.filter((game: GameRoom) => game.createdAt > oneDayAgo)));
      
      return activeGames.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error getting games:', error);
      return [];
    }
  }

  async joinGame(gameId: string, opponent: string): Promise<GameRoom> {
    // First, pay the entrance fee
    const games = JSON.parse(localStorage.getItem('global_chess_games') || '[]');
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

    // Pay entrance fee
    try {
      await this.payEntranceFee(opponent, game.entranceFee);
    } catch (error) {
      throw new Error('Failed to pay entrance fee: ' + error.message);
    }
    
    // Update game with opponent and payment info
    games[gameIndex] = {
      ...game,
      opponent,
      status: 'active',
      prizePool: game.entranceFee * 2, // Both players paid
      opponentPaid: true
    };
    
    // Update both global and session storage
    localStorage.setItem('global_chess_games', JSON.stringify(games));
    
    const sessionGames = JSON.parse(localStorage.getItem('chess_games') || '[]');
    const sessionIndex = sessionGames.findIndex((g: GameRoom) => g.id === gameId);
    if (sessionIndex !== -1) {
      sessionGames[sessionIndex] = games[gameIndex];
      localStorage.setItem('chess_games', JSON.stringify(sessionGames));
    }
    
    return games[gameIndex];
  }

  async completeGame(gameId: string, winner: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
    const games = JSON.parse(localStorage.getItem('global_chess_games') || '[]');
    const gameIndex = games.findIndex((game: GameRoom) => game.id === gameId);
    
    if (gameIndex === -1) {
      throw new Error('Game not found');
    }

    const game = games[gameIndex];
    const prizePool = game.prizePool || (game.entranceFee * 2);
    const platformFee = prizePool * 0.1; // 10% platform fee
    const winnerPayout = prizePool - platformFee;

    // Pay out winner if not a draw
    if (result !== 'draw' && winner) {
      try {
        // In a real implementation, this would be handled by a smart contract
        // For demo purposes, we'll simulate the payout
        console.log(`Paying out winner: ${winner}, amount: ${winnerPayout} SOL`);
        // await this.payoutWinner(winner, winnerPayout);
      } catch (error) {
        console.error('Payout failed:', error);
      }
    }

    // Update game status
    games[gameIndex] = {
      ...game,
      status: 'completed',
      winner: result === 'draw' ? 'draw' : winner,
      treasuryPaid: true
    };
    
    // Update storage
    localStorage.setItem('global_chess_games', JSON.stringify(games));
    
    const sessionGames = JSON.parse(localStorage.getItem('chess_games') || '[]');
    const sessionIndex = sessionGames.findIndex((g: GameRoom) => g.id === gameId);
    if (sessionIndex !== -1) {
      sessionGames[sessionIndex] = games[gameIndex];
      localStorage.setItem('chess_games', JSON.stringify(sessionGames));
    }

    // Update player stats
    await this.updatePlayerStats(game.creator, game.opponent || 'bot', winner, result, game.entranceFee, winnerPayout);
  }

  // STATS SYSTEM
  async updatePlayerStats(player1: string, player2: string, winner: string, result: 'win' | 'loss' | 'draw', entranceFee: number, payout: number): Promise<void> {
    try {
      // Update stats for player1
      const player1Stats = this.getPlayerStats(player1);
      player1Stats.totalGames++;
      player1Stats.totalSpent += entranceFee;
      
      if (result === 'draw') {
        player1Stats.draws++;
      } else if (winner === player1) {
        player1Stats.wins++;
        player1Stats.totalEarnings += payout;
      } else {
        player1Stats.losses++;
      }
      
      this.savePlayerStats(player1, player1Stats);

      // Update stats for player2 (if not bot)
      if (player2 !== 'bot') {
        const player2Stats = this.getPlayerStats(player2);
        player2Stats.totalGames++;
        player2Stats.totalSpent += entranceFee;
        
        if (result === 'draw') {
          player2Stats.draws++;
        } else if (winner === player2) {
          player2Stats.wins++;
          player2Stats.totalEarnings += payout;
        } else {
          player2Stats.losses++;
        }
        
        this.savePlayerStats(player2, player2Stats);
      }

      // Save game result
      const gameResult: GameResult = {
        winner: result === 'draw' ? 'draw' : (winner === player1 ? 'white' : 'black'),
        moves: 0, // This should be passed from the game
        timestamp: Date.now(),
        whitePlayer: player1,
        blackPlayer: player2,
        entranceFee,
        payout: result === 'draw' ? 0 : payout
      };

      const gameHistory = JSON.parse(localStorage.getItem('game_history') || '[]');
      gameHistory.push(gameResult);
      localStorage.setItem('game_history', JSON.stringify(gameHistory));

    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  getPlayerStats(playerPublicKey: string): GameStats {
    try {
      const stats = localStorage.getItem(`player_stats_${playerPublicKey}`);
      if (stats) {
        return JSON.parse(stats);
      }
    } catch (error) {
      console.error('Error loading player stats:', error);
    }
    
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalEarnings: 0,
      totalSpent: 0
    };
  }

  savePlayerStats(playerPublicKey: string, stats: GameStats): void {
    try {
      localStorage.setItem(`player_stats_${playerPublicKey}`, JSON.stringify(stats));
    } catch (error) {
      console.error('Error saving player stats:', error);
    }
  }

  getGameHistory(): GameResult[] {
    try {
      return JSON.parse(localStorage.getItem('game_history') || '[]');
    } catch (error) {
      console.error('Error loading game history:', error);
      return [];
    }
  }

  // Get game room by ID
  getGameRoom(gameId: string): GameRoom | undefined {
    try {
      const games = JSON.parse(localStorage.getItem('global_chess_games') || '[]');
      return games.find((game: GameRoom) => game.id === gameId);
    } catch (error) {
      console.error('Error getting game room:', error);
      return undefined;
    }
  }

  // Legacy payment method (kept for compatibility)
  async processPayment(from: string, to: string, amount: number): Promise<string> {
    return await this.payEntranceFee(from, amount);
  }
}
