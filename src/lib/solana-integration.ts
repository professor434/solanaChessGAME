import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

export const TREASURY_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

export interface GameRoom {
  id: string;
  creator: string;
  entranceFee: number;
  status: 'waiting' | 'active' | 'completed';
  createdAt: number;
  opponent?: string;
  winner?: string;
}

export class SolanaGameManager {
  private connection: Connection;
  private gameRooms: Map<string, GameRoom> = new Map();

  constructor() {
    this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  }

  async connectWallet(): Promise<WalletState> {
    try {
      // Check if wallet is available
      const { solana } = window as any;
      
      if (!solana) {
        throw new Error('Solana wallet not found! Please install Phantom, Solflare, or another Solana wallet.');
      }

      // Connect to wallet
      const response = await solana.connect();
      const publicKey = response.publicKey.toString();
      
      // Get balance
      const balance = await this.getBalance(new PublicKey(publicKey));
      
      return {
        connected: true,
        publicKey,
        balance
      };
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return 0;
    }
  }

  async requestAirdrop(publicKey: PublicKey, amount: number = 2): Promise<string> {
    try {
      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error: any) {
      console.error('Airdrop failed:', error);
      throw new Error('Airdrop failed. You may have reached the daily limit.');
    }
  }

  async createGame(creatorPublicKey: string, entranceFee: number): Promise<GameRoom> {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const gameRoom: GameRoom = {
      id: gameId,
      creator: creatorPublicKey,
      entranceFee,
      status: 'waiting',
      createdAt: Date.now()
    };

    this.gameRooms.set(gameId, gameRoom);
    return gameRoom;
  }

  async joinGame(gameId: string, playerPublicKey: string): Promise<GameRoom> {
    const gameRoom = this.gameRooms.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }

    if (gameRoom.status !== 'waiting') {
      throw new Error('Game is not available for joining');
    }

    if (gameRoom.creator === playerPublicKey) {
      throw new Error('Cannot join your own game');
    }

    // Update game room
    gameRoom.opponent = playerPublicKey;
    gameRoom.status = 'active';
    
    this.gameRooms.set(gameId, gameRoom);
    return gameRoom;
  }

  getAvailableGames(): GameRoom[] {
    return Array.from(this.gameRooms.values())
      .filter(room => room.status === 'waiting')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getGameRoom(gameId: string): GameRoom | undefined {
    return this.gameRooms.get(gameId);
  }

  async completeGame(gameId: string, winner: string): Promise<void> {
    const gameRoom = this.gameRooms.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }

    gameRoom.status = 'completed';
    gameRoom.winner = winner;
    
    this.gameRooms.set(gameId, gameRoom);
  }

  async sendPayment(fromPublicKey: PublicKey, toPublicKey: PublicKey, amount: number): Promise<string> {
    try {
      const { solana } = window as any;
      
      if (!solana) {
        throw new Error('Wallet not connected');
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromPublicKey,
          toPubkey: toPublicKey,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );

      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPublicKey;

      const signedTransaction = await solana.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error: any) {
      console.error('Payment failed:', error);
      throw new Error(error.message || 'Payment failed');
    }
  }
}