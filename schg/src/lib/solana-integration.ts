import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Treasury wallet address provided by user
export const TREASURY_WALLET = '7CknuFiZJA4bWTivznW4CkB9ZP46GEoJKmy6KjRbLLDh';
export const PLATFORM_FEE_PERCENTAGE = 0.1; // 10%
export const WINNER_PERCENTAGE = 0.9; // 90%

export interface GameResult {
  winner: 'white' | 'black' | 'draw';
  moves: number;
  timestamp: number;
  whitePlayer: string;
  blackPlayer: string;
}

export interface WagerInfo {
  amount: number; // in SOL
  whitePlayer: string;
  blackPlayer: string;
  gameId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

export interface GamePool {
  totalAmount: number;
  entranceFee: number;
  players: string[];
  gameId: string;
}

export class SolanaChessIntegration {
  private connection: Connection;
  private network: string;

  constructor(network: 'devnet' | 'mainnet-beta' = 'devnet') {
    this.network = network;
    const endpoint = network === 'devnet' 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';
    
    this.connection = new Connection(endpoint, 'confirmed');
  }

  public async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new Error('Failed to fetch wallet balance');
    }
  }

  public async createWager(
    wallet: WalletContextState,
    opponentAddress: string,
    wagerAmount: number,
    gameId: string
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const opponentPublicKey = new PublicKey(opponentAddress);
      const wagerLamports = wagerAmount * LAMPORTS_PER_SOL;

      // Create a simple escrow transaction (in a real implementation, you'd use a program)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: opponentPublicKey, // In reality, this would be an escrow account
          lamports: wagerLamports,
        })
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize()
      );

      await this.connection.confirmTransaction(signature);
      
      // Store wager info in localStorage for demo purposes
      this.storeWagerInfo({
        amount: wagerAmount,
        whitePlayer: wallet.publicKey.toString(),
        blackPlayer: opponentAddress,
        gameId,
        status: 'active'
      });

      return signature;
    } catch (error) {
      console.error('Error creating wager:', error);
      throw new Error('Failed to create wager');
    }
  }

  public async recordGameResult(
    wallet: WalletContextState,
    gameResult: GameResult,
    wagerInfo?: WagerInfo
  ): Promise<string | null> {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Store game result locally
      this.storeGameResult(gameResult);

      // If there's a wager, handle payout
      if (wagerInfo && wallet.signTransaction) {
        return await this.handleWagerPayout(wallet, gameResult, wagerInfo);
      }

      return null;
    } catch (error) {
      console.error('Error recording game result:', error);
      throw new Error('Failed to record game result');
    }
  }

  private async handleWagerPayout(
    wallet: WalletContextState,
    gameResult: GameResult,
    wagerInfo: WagerInfo
  ): Promise<string> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const totalPayout = wagerInfo.amount * 2; // Winner takes all
    let winnerAddress: string;

    if (gameResult.winner === 'white') {
      winnerAddress = wagerInfo.whitePlayer;
    } else if (gameResult.winner === 'black') {
      winnerAddress = wagerInfo.blackPlayer;
    } else {
      // Draw - split the pot
      // In a real implementation, you'd return funds to both players
      winnerAddress = wagerInfo.whitePlayer;
    }

    const winnerPublicKey = new PublicKey(winnerAddress);
    const payoutLamports = totalPayout * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey, // In reality, this would be the escrow account
        toPubkey: winnerPublicKey,
        lamports: payoutLamports,
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(
      signedTransaction.serialize()
    );

    await this.connection.confirmTransaction(signature);

    // Update wager status
    wagerInfo.status = 'completed';
    this.storeWagerInfo(wagerInfo);

    return signature;
  }

  public async getTransactionHistory(publicKey: PublicKey): Promise<Array<{ signature: string; timestamp: number }>> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 10 });
      return signatures.map(sig => ({
        signature: sig.signature,
        timestamp: sig.blockTime || 0
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  public validateSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private storeGameResult(result: GameResult): void {
    const existingResults = this.getStoredGameResults();
    existingResults.push(result);
    localStorage.setItem('chess_game_results', JSON.stringify(existingResults));
  }

  public getStoredGameResults(): GameResult[] {
    const stored = localStorage.getItem('chess_game_results');
    return stored ? JSON.parse(stored) : [];
  }

  private storeWagerInfo(wager: WagerInfo): void {
    const existingWagers = this.getStoredWagers();
    const index = existingWagers.findIndex(w => w.gameId === wager.gameId);
    
    if (index >= 0) {
      existingWagers[index] = wager;
    } else {
      existingWagers.push(wager);
    }
    
    localStorage.setItem('chess_wagers', JSON.stringify(existingWagers));
  }

  public getStoredWagers(): WagerInfo[] {
    const stored = localStorage.getItem('chess_wagers');
    return stored ? JSON.parse(stored) : [];
  }

  public getWagerByGameId(gameId: string): WagerInfo | null {
    const wagers = this.getStoredWagers();
    return wagers.find(w => w.gameId === gameId) || null;
  }

  public async estimateTransactionFee(): Promise<number> {
    try {
      // Get recent blockhash for fee estimation
      const { feeCalculator } = await this.connection.getRecentBlockhash();
      return feeCalculator.lamportsPerSignature / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error estimating transaction fee:', error);
      return 0.000005; // Default estimate
    }
  }

  public getNetworkStats(): { network: string; endpoint: string } {
    return {
      network: this.network,
      endpoint: this.connection.rpcEndpoint
    };
  }
}

// Legacy class for backward compatibility
export class SolanaGameManager {
  private connection: Connection;
  private treasuryPublicKey: PublicKey;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(rpcUrl || 'https://api.devnet.solana.com', 'confirmed');
    this.treasuryPublicKey = new PublicKey(TREASURY_WALLET);
  }

  public async connectWallet(): Promise<WalletState> {
    return {
      connected: true,
      publicKey: 'MockWallet' + Math.random().toString(36).substr(2, 9),
      balance: Math.random() * 10
    };
  }

  public async getBalance(publicKey: string): Promise<number> {
    try {
      return Math.random() * 10;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return 0;
    }
  }

  public async createGamePool(entranceFee: number): Promise<GamePool> {
    const gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    return {
      totalAmount: 0,
      entranceFee,
      players: [],
      gameId
    };
  }

  public async joinGame(gamePool: GamePool, playerWallet: string): Promise<{ success: boolean; txHash?: string }> {
    try {
      const txHash = 'mock_tx_' + Math.random().toString(36).substr(2, 16);
      
      gamePool.players.push(playerWallet);
      gamePool.totalAmount += gamePool.entranceFee;
      
      console.log(`Player ${playerWallet} joined game with ${gamePool.entranceFee} SOL`);
      
      return { success: true, txHash };
    } catch (error) {
      console.error('Error joining game:', error);
      return { success: false };
    }
  }

  public async distributePrize(gamePool: GamePool, winnerWallet: string): Promise<{ success: boolean; txHash?: string }> {
    try {
      const totalPrize = gamePool.totalAmount;
      const platformFee = totalPrize * PLATFORM_FEE_PERCENTAGE;
      const winnerPrize = totalPrize * WINNER_PERCENTAGE;
      
      console.log(`Distributing prizes:`);
      console.log(`- Platform fee (${PLATFORM_FEE_PERCENTAGE * 100}%): ${platformFee} SOL to ${TREASURY_WALLET}`);
      console.log(`- Winner prize (${WINNER_PERCENTAGE * 100}%): ${winnerPrize} SOL to ${winnerWallet}`);
      
      const txHash = 'prize_tx_' + Math.random().toString(36).substr(2, 16);
      
      return { success: true, txHash };
    } catch (error) {
      console.error('Error distributing prize:', error);
      return { success: false };
    }
  }

  public formatSOL(lamports: number): string {
    return (lamports / LAMPORTS_PER_SOL).toFixed(4);
  }

  public solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }
}

// Game state management for multiplayer
export class GameStateManager {
  private gameStates: Map<string, Record<string, unknown>> = new Map();
  
  public createGame(gameId: string, player1: string, entranceFee: number): void {
    this.gameStates.set(gameId, {
      id: gameId,
      players: { white: player1, black: null },
      entranceFee,
      status: 'waiting_for_player',
      createdAt: Date.now()
    });
  }
  
  public joinGame(gameId: string, player2: string): boolean {
    const game = this.gameStates.get(gameId);
    if (game && game.players && typeof game.players === 'object' && 'black' in game.players && !game.players.black) {
      (game.players as { black: string | null }).black = player2;
      game.status = 'ready_to_start';
      return true;
    }
    return false;
  }
  
  public getGame(gameId: string): Record<string, unknown> | undefined {
    return this.gameStates.get(gameId);
  }
  
  public updateGameState(gameId: string, newState: Record<string, unknown>): void {
    const game = this.gameStates.get(gameId);
    if (game) {
      Object.assign(game, newState);
    }
  }
}

// Utility functions for formatting
export function formatSolAmount(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function formatAddress(address: string, length: number = 8): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function generateGameId(): string {
  return `chess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}