# Decentralized Solana Chess Game - MVP Implementation

## Core Features to Implement

### 1. Chess Game Engine (src/components/chess/)
- **ChessBoard.tsx** - Interactive chess board component
- **ChessPiece.tsx** - Individual chess piece component
- **GameLogic.ts** - Chess rules, move validation, checkmate detection
- **GameState.ts** - Game state management and turn handling

### 2. Solana Integration (src/lib/solana/)
- **WalletConnection.ts** - Solana wallet adapter integration
- **GameContract.ts** - Mock smart contract interactions for payments
- **SolanaConfig.ts** - RPC configuration and treasury wallet setup

### 3. Game Flow Components (src/components/game/)
- **WalletConnect.tsx** - Wallet connection interface
- **GameLobby.tsx** - Player matching and entrance fee payment
- **GameRoom.tsx** - Main game interface with chess board
- **GameResults.tsx** - Winner announcement and prize distribution

### 4. Core Pages (src/pages/)
- **Index.tsx** - Landing page with game introduction
- **Game.tsx** - Main game page with full functionality

### 5. Configuration
- Treasury wallet: 7CknuFiZJA4bWTivznW4CkB9ZP46GEoJKmy6KjRbLLDh
- Platform fee: 10% to treasury, 90% to winner
- Entrance fee system with SOL payments

## Implementation Strategy
- Start with chess game logic and UI
- Add Solana wallet integration
- Implement payment flow (simulated for MVP)
- Create player matching system
- Add game state persistence

## File Structure (Max 8 files)
1. src/pages/Index.tsx - Landing page
2. src/pages/Game.tsx - Main game page
3. src/components/ChessBoard.tsx - Chess game component
4. src/lib/chess-logic.ts - Game rules and logic
5. src/lib/solana-integration.ts - Wallet and payment handling
6. src/components/WalletConnect.tsx - Wallet connection UI
7. src/components/GameLobby.tsx - Player matching interface
8. src/components/GameResults.tsx - Results and payout UI