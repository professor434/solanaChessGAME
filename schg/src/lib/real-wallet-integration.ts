import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface GamePool {
  gameId: string;
  players: string[];
  entranceFee: number;
  totalAmount: number;
  status: 'waiting' | 'active' | 'completed';
  createdAt: number;
  createdBy: string;
}

export interface GameResult {
  winner: 'white' | 'black' | 'draw';
  moves: number;
  timestamp: number;
  whitePlayer: string;
  blackPlayer: string;
}

export class RealSolanaIntegration {
  private connection: Connection;
  private network: string;
  private treasuryWallet = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');

  constructor(network: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet') {
    this.network = network;
    this.connection = new Connection(clusterApiUrl(network), 'confirmed');
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new Error('Failed to fetch wallet balance');
    }
  }

  async requestAirdrop(publicKey: PublicKey, amount: number = 2): Promise<string> {
    try {
      if (this.network === 'mainnet-beta') {
        throw new Error('Airdrop not available on mainnet');
      }

      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (error) {
      console.error('Error requesting airdrop:', error);
      throw new Error('Failed to request airdrop. Please try again later.');
    }
  }

  async createGamePool(
    wallet: WalletContextState,
    entranceFee: number,
    isPrivate: boolean = false
  ): Promise<GamePool> {
    if (!wallet.publicKey || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    try {
      // For real games with entrance fees, validate balance
      if (entranceFee > 0) {
        const balance = await this.getBalance(wallet.publicKey);
        if (balance < entranceFee) {
          throw new Error(`Insufficient balance. Required: ${entranceFee} SOL, Available: ${balance.toFixed(4)} SOL`);
        }

        // Create and send transaction for entrance fee
        if (wallet.sendTransaction) {
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: this.treasuryWallet,
              lamports: entranceFee * LAMPORTS_PER_SOL,
            })
          );

          const signature = await wallet.sendTransaction(transaction, this.connection);
          await this.connection.confirmTransaction(signature, 'confirmed');
          console.log('Entrance fee transaction confirmed:', signature);
        }
      }

      // Create game pool
      const gamePool: GamePool = {
        gameId: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        players: [wallet.publicKey.toString()],
        entranceFee,
        totalAmount: entranceFee,
        status: 'waiting',
        createdAt: Date.now(),
        createdBy: wallet.publicKey.toString()
      };

      // Store game pool
      this.storeGamePool(gamePool);
      return gamePool;
    } catch (error) {
      console.error('Error creating game pool:', error);
      throw error;
    }
  }

  async joinGamePool(
    wallet: WalletContextState,
    gamePool: GamePool
  ): Promise<GamePool> {
    if (!wallet.publicKey || !wallet.connected) {
      throw new Error('Wallet not connected');
    }

    if (gamePool.players.length >= 2) {
      throw new Error('Game pool is full');
    }

    if (gamePool.players.includes(wallet.publicKey.toString())) {
      throw new Error('You are already in this game');
    }

    try {
      // For real games with entrance fees, validate balance and send payment
      if (gamePool.entranceFee > 0) {
        const balance = await this.getBalance(wallet.publicKey);
        if (balance < gamePool.entranceFee) {
          throw new Error(`Insufficient balance. Required: ${gamePool.entranceFee} SOL, Available: ${balance.toFixed(4)} SOL`);
        }

        // Create and send transaction for entrance fee
        if (wallet.sendTransaction) {
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: this.treasuryWallet,
              lamports: gamePool.entranceFee * LAMPORTS_PER_SOL,
            })
          );

          const signature = await wallet.sendTransaction(transaction, this.connection);
          await this.connection.confirmTransaction(signature, 'confirmed');
          console.log('Join game fee transaction confirmed:', signature);
        }
      }

      // Update game pool
      const updatedGamePool: GamePool = {
        ...gamePool,
        players: [...gamePool.players, wallet.publicKey.toString()],
        totalAmount: gamePool.entranceFee * 2,
        status: 'active'
      };

      // Update stored game pool
      this.updateGamePool(updatedGamePool);
      return updatedGamePool;
    } catch (error) {
      console.error('Error joining game pool:', error);
      throw error;
    }
  }

  async distributePrize(
    wallet: WalletContextState,
    result: GameResult,
    gamePool: GamePool
  ): Promise<void> {
    if (!wallet.publicKey || !wallet.connected || !wallet.sendTransaction) {
      throw new Error('Wallet not connected or missing sendTransaction');
    }

    if (gamePool.entranceFee === 0) {
      console.log('No prize to distribute for free game');
      return;
    }

    try {
      const totalPrize = gamePool.totalAmount;
      const platformFee = totalPrize * 0.1; // 10% platform fee
      const winnerPrize = totalPrize * 0.9; // 90% to winner

      let winnerAddress: string;
      
      if (result.winner === 'draw') {
        // In case of draw, split the prize (minus platform fee)
        const drawPrize = winnerPrize / 2;
        
        // Send half to each player
        for (const playerAddress of gamePool.players) {
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: this.treasuryWallet,
              toPubkey: new PublicKey(playerAddress),
              lamports: drawPrize * LAMPORTS_PER_SOL,
            })
          );

          // Note: In a real implementation, this would be handled by a program authority
          console.log(`Would send ${drawPrize} SOL to ${playerAddress} (draw)`);
        }
        return;
      }

      // Determine winner address
      if (result.winner === 'white') {
        winnerAddress = result.whitePlayer;
      } else {
        winnerAddress = result.blackPlayer;
      }

      // Create prize distribution transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.treasuryWallet,
          toPubkey: new PublicKey(winnerAddress),
          lamports: winnerPrize * LAMPORTS_PER_SOL,
        })
      );

      // Note: In a real implementation, this would be signed by a program authority
      // For demo purposes, we'll just log the transaction
      console.log('Prize Distribution:', {
        winner: winnerAddress,
        amount: winnerPrize,
        platformFee: platformFee,
        totalPool: totalPrize
      });

      // Update game pool status
      const completedGamePool: GamePool = {
        ...gamePool,
        status: 'completed'
      };
      this.updateGamePool(completedGamePool);

    } catch (error) {
      console.error('Error distributing prize:', error);
      throw new Error('Failed to distribute prize');
    }
  }

  getStoredGamePools(): GamePool[] {
    try {
      const stored = localStorage.getItem('chess_game_pools');
      if (!stored) return [];
      
      const pools = JSON.parse(stored) as GamePool[];
      
      // Filter out old games (older than 1 hour) and completed games
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const activePools = pools.filter(pool => 
        pool.createdAt > oneHourAgo && 
        pool.status !== 'completed'
      );
      
      // Update storage with filtered pools
      localStorage.setItem('chess_game_pools', JSON.stringify(activePools));
      
      return activePools;
    } catch (error) {
      console.error('Error getting stored game pools:', error);
      return [];
    }
  }

  getGamePoolById(gameId: string): GamePool | null {
    const pools = this.getStoredGamePools();
    return pools.find(pool => pool.gameId === gameId) || null;
  }

  private storeGamePool(gamePool: GamePool): void {
    try {
      const existingPools = this.getStoredGamePools();
      const updatedPools = [...existingPools, gamePool];
      localStorage.setItem('chess_game_pools', JSON.stringify(updatedPools));
    } catch (error) {
      console.error('Error storing game pool:', error);
    }
  }

  private updateGamePool(gamePool: GamePool): void {
    try {
      const existingPools = this.getStoredGamePools();
      const updatedPools = existingPools.map(pool => 
        pool.gameId === gamePool.gameId ? gamePool : pool
      );
      localStorage.setItem('chess_game_pools', JSON.stringify(updatedPools));
    } catch (error) {
      console.error('Error updating game pool:', error);
    }
  }

  // Utility method to check if wallet can send transactions
  canSendTransaction(wallet: WalletContextState): boolean {
    return !!(wallet.connected && wallet.publicKey && wallet.sendTransaction);
  }

  // Get network info
  getNetworkInfo(): { network: string; endpoint: string } {
    return {
      network: this.network,
      endpoint: this.connection.rpcEndpoint
    };
  }

  // Validate SOL amount
  isValidSolAmount(amount: number): boolean {
    return amount > 0 && amount <= 10 && Number.isFinite(amount);
  }

  // Format SOL amount for display
  formatSolAmount(amount: number): string {
    return amount.toFixed(4);
  }
}