export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

export interface ChessPosition {
  row: number;
  col: number;
}

// For backwards compatibility
export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  gameStatus: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';
  winner: PieceColor | null;
  moveCount: number;
}

export interface MoveResult {
  success: boolean;
  error?: string;
  gameStatus?: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';
}

// Create initial chess board setup
export function createInitialGameState(): GameState {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Set up white pieces (bottom)
  board[7] = [
    { type: 'rook', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'bishop', color: 'white' },
    { type: 'queen', color: 'white' },
    { type: 'king', color: 'white' },
    { type: 'bishop', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'rook', color: 'white' }
  ];
  
  for (let col = 0; col < 8; col++) {
    board[6][col] = { type: 'pawn', color: 'white' };
  }
  
  // Set up black pieces (top)
  board[0] = [
    { type: 'rook', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'bishop', color: 'black' },
    { type: 'queen', color: 'black' },
    { type: 'king', color: 'black' },
    { type: 'bishop', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'rook', color: 'black' }
  ];
  
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'pawn', color: 'black' };
  }
  
  return {
    board,
    currentPlayer: 'white',
    gameStatus: 'playing',
    winner: null,
    moveCount: 0
  };
}

// Initialize game function for backwards compatibility
export function initializeGame(): GameState {
  return createInitialGameState();
}

export class ChessGame {
  private gameState: GameState;
  
  constructor() {
    this.gameState = createInitialGameState();
  }
  
  getGameState(): GameState {
    return { ...this.gameState };
  }
  
  isValidPosition(pos: ChessPosition | Position): boolean {
    return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
  }
  
  getPiece(pos: ChessPosition | Position): ChessPiece | null {
    if (!this.isValidPosition(pos)) return null;
    return this.gameState.board[pos.row][pos.col];
  }
  
  setPiece(pos: ChessPosition | Position, piece: ChessPiece | null): void {
    if (this.isValidPosition(pos)) {
      this.gameState.board[pos.row][pos.col] = piece;
    }
  }
  
  getValidMoves(from: ChessPosition | Position): ChessPosition[] {
    const piece = this.getPiece(from);
    if (!piece || piece.color !== this.gameState.currentPlayer) {
      return [];
    }
    
    const moves: ChessPosition[] = [];
    
    switch (piece.type) {
      case 'pawn':
        moves.push(...this.getPawnMoves(from, piece.color));
        break;
      case 'rook':
        moves.push(...this.getRookMoves(from));
        break;
      case 'bishop':
        moves.push(...this.getBishopMoves(from));
        break;
      case 'queen':
        moves.push(...this.getQueenMoves(from));
        break;
      case 'king':
        moves.push(...this.getKingMoves(from));
        break;
      case 'knight':
        moves.push(...this.getKnightMoves(from));
        break;
    }
    
    // Filter out moves that would put own king in check
    return moves.filter(to => !this.wouldBeInCheckAfterMove(from, to));
  }
  
  private getPawnMoves(from: ChessPosition | Position, color: PieceColor): ChessPosition[] {
    const moves: ChessPosition[] = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    
    // Forward move
    const oneForward = { row: from.row + direction, col: from.col };
    if (this.isValidPosition(oneForward) && !this.getPiece(oneForward)) {
      moves.push(oneForward);
      
      // Two squares forward from starting position
      if (from.row === startRow) {
        const twoForward = { row: from.row + 2 * direction, col: from.col };
        if (this.isValidPosition(twoForward) && !this.getPiece(twoForward)) {
          moves.push(twoForward);
        }
      }
    }
    
    // Diagonal captures
    const leftCapture = { row: from.row + direction, col: from.col - 1 };
    const rightCapture = { row: from.row + direction, col: from.col + 1 };
    
    if (this.isValidPosition(leftCapture)) {
      const leftPiece = this.getPiece(leftCapture);
      if (leftPiece && leftPiece.color !== color) {
        moves.push(leftCapture);
      }
    }
    
    if (this.isValidPosition(rightCapture)) {
      const rightPiece = this.getPiece(rightCapture);
      if (rightPiece && rightPiece.color !== color) {
        moves.push(rightCapture);
      }
    }
    
    return moves;
  }
  
  private getRookMoves(from: ChessPosition | Position): ChessPosition[] {
    const moves: ChessPosition[] = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    
    for (const [dRow, dCol] of directions) {
      for (let i = 1; i < 8; i++) {
        const to = { row: from.row + i * dRow, col: from.col + i * dCol };
        if (!this.isValidPosition(to)) break;
        
        const piece = this.getPiece(to);
        if (!piece) {
          moves.push(to);
        } else {
          if (piece.color !== this.getPiece(from)!.color) {
            moves.push(to);
          }
          break;
        }
      }
    }
    
    return moves;
  }
  
  private getBishopMoves(from: ChessPosition | Position): ChessPosition[] {
    const moves: ChessPosition[] = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dRow, dCol] of directions) {
      for (let i = 1; i < 8; i++) {
        const to = { row: from.row + i * dRow, col: from.col + i * dCol };
        if (!this.isValidPosition(to)) break;
        
        const piece = this.getPiece(to);
        if (!piece) {
          moves.push(to);
        } else {
          if (piece.color !== this.getPiece(from)!.color) {
            moves.push(to);
          }
          break;
        }
      }
    }
    
    return moves;
  }
  
  private getQueenMoves(from: ChessPosition | Position): ChessPosition[] {
    return [...this.getRookMoves(from), ...this.getBishopMoves(from)];
  }
  
  private getKingMoves(from: ChessPosition | Position): ChessPosition[] {
    const moves: ChessPosition[] = [];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dRow, dCol] of directions) {
      const to = { row: from.row + dRow, col: from.col + dCol };
      if (this.isValidPosition(to)) {
        const piece = this.getPiece(to);
        if (!piece || piece.color !== this.getPiece(from)!.color) {
          moves.push(to);
        }
      }
    }
    
    return moves;
  }
  
  private getKnightMoves(from: ChessPosition | Position): ChessPosition[] {
    const moves: ChessPosition[] = [];
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dRow, dCol] of knightMoves) {
      const to = { row: from.row + dRow, col: from.col + dCol };
      if (this.isValidPosition(to)) {
        const piece = this.getPiece(to);
        if (!piece || piece.color !== this.getPiece(from)!.color) {
          moves.push(to);
        }
      }
    }
    
    return moves;
  }
  
  private findKing(color: PieceColor): ChessPosition | null {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return { row, col };
        }
      }
    }
    return null;
  }
  
  isInCheck(color: PieceColor): boolean {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;
    
    // Check if any opponent piece can attack the king
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col];
        if (piece && piece.color !== color) {
          const moves = this.getValidMovesForPiece({ row, col }, piece);
          if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private getValidMovesForPiece(from: ChessPosition | Position, piece: ChessPiece): ChessPosition[] {
    // Similar to getValidMoves but without checking for check (to avoid infinite recursion)
    const moves: ChessPosition[] = [];
    
    switch (piece.type) {
      case 'pawn':
        moves.push(...this.getPawnMoves(from, piece.color));
        break;
      case 'rook':
        moves.push(...this.getRookMoves(from));
        break;
      case 'bishop':
        moves.push(...this.getBishopMoves(from));
        break;
      case 'queen':
        moves.push(...this.getQueenMoves(from));
        break;
      case 'king':
        moves.push(...this.getKingMoves(from));
        break;
      case 'knight':
        moves.push(...this.getKnightMoves(from));
        break;
    }
    
    return moves;
  }
  
  private wouldBeInCheckAfterMove(from: ChessPosition | Position, to: ChessPosition | Position): boolean {
    // Make temporary move
    const originalPiece = this.getPiece(from);
    const capturedPiece = this.getPiece(to);
    
    this.setPiece(to, originalPiece);
    this.setPiece(from, null);
    
    const inCheck = this.isInCheck(originalPiece!.color);
    
    // Restore board
    this.setPiece(from, originalPiece);
    this.setPiece(to, capturedPiece);
    
    return inCheck;
  }
  
  makeMove(from: ChessPosition | Position, to: ChessPosition | Position): MoveResult {
    const piece = this.getPiece(from);
    
    if (!piece) {
      return { success: false, error: 'No piece at source position' };
    }
    
    if (piece.color !== this.gameState.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }
    
    const validMoves = this.getValidMoves(from);
    const isValidMove = validMoves.some(move => move.row === to.row && move.col === to.col);
    
    if (!isValidMove) {
      return { success: false, error: 'Invalid move' };
    }
    
    // Make the move
    this.setPiece(to, piece);
    this.setPiece(from, null);
    
    // Mark piece as moved (for castling, en passant, etc.)
    if (piece) {
      piece.hasMoved = true;
    }
    
    // Switch players
    this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';
    this.gameState.moveCount++;
    
    // Check game status
    const opponentColor = this.gameState.currentPlayer;
    const inCheck = this.isInCheck(opponentColor);
    const hasValidMoves = this.hasValidMoves(opponentColor);
    
    if (inCheck && !hasValidMoves) {
      this.gameState.gameStatus = 'checkmate';
      this.gameState.winner = piece.color;
      return { success: true, gameStatus: 'checkmate' };
    } else if (!hasValidMoves) {
      this.gameState.gameStatus = 'stalemate';
      return { success: true, gameStatus: 'stalemate' };
    } else if (inCheck) {
      this.gameState.gameStatus = 'check';
      return { success: true, gameStatus: 'check' };
    } else {
      this.gameState.gameStatus = 'playing';
      return { success: true, gameStatus: 'playing' };
    }
  }
  
  private hasValidMoves(color: PieceColor): boolean {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col];
        if (piece && piece.color === color) {
          const moves = this.getValidMoves({ row, col });
          if (moves.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

// Export standalone functions for backwards compatibility
export function getValidMoves(gameState: GameState, position: ChessPosition | Position): ChessPosition[] {
  const game = new ChessGame();
  game['gameState'] = gameState; // Access private property for compatibility
  return game.getValidMoves(position);
}

export function makeMove(gameState: GameState, from: ChessPosition | Position, to: ChessPosition | Position): GameState | null {
  const game = new ChessGame();
  game['gameState'] = gameState; // Access private property for compatibility
  const result = game.makeMove(from, to);
  return result.success ? game.getGameState() : null;
}

export function isGameOver(gameState: GameState): { isGameOver: boolean; result: string } {
  if (gameState.gameStatus === 'checkmate') {
    const winner = gameState.winner === 'white' ? 'White' : 'Black';
    return { isGameOver: true, result: `${winner} wins by checkmate!` };
  } else if (gameState.gameStatus === 'stalemate') {
    return { isGameOver: true, result: 'Game ended in stalemate!' };
  } else if (gameState.gameStatus === 'draw') {
    return { isGameOver: true, result: 'Game ended in a draw!' };
  }
  
  return { isGameOver: false, result: '' };
}

export function getGameResult(gameState: GameState): string {
  const { isGameOver, result } = isGameOver(gameState);
  return isGameOver ? result : 'Game in progress';
}
