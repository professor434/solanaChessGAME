export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
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

export interface GameState {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  gameStatus: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';
  winner: PieceColor | null;
  moveHistory: string[];
  kingPositions: { white: ChessPosition; black: ChessPosition };
  enPassantTarget: ChessPosition | null;
  castlingRights: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
  fiftyMoveRule: number;
  moveCount: number;
}

export class ChessGame {
  private gameState: GameState;

  constructor() {
    this.gameState = this.initializeGame();
  }

  private initializeGame(): GameState {
    const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Initialize pawns
    for (let col = 0; col < 8; col++) {
      board[1][col] = { type: 'pawn', color: 'black' };
      board[6][col] = { type: 'pawn', color: 'white' };
    }
    
    // Initialize other pieces
    const pieceOrder: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let col = 0; col < 8; col++) {
      board[0][col] = { type: pieceOrder[col], color: 'black' };
      board[7][col] = { type: pieceOrder[col], color: 'white' };
    }

    return {
      board,
      currentPlayer: 'white',
      gameStatus: 'playing',
      winner: null,
      moveHistory: [],
      kingPositions: { white: { row: 7, col: 4 }, black: { row: 0, col: 4 } },
      enPassantTarget: null,
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true
      },
      fiftyMoveRule: 0,
      moveCount: 0
    };
  }

  getBoard(): (ChessPiece | null)[][] {
    return this.gameState.board.map(row => [...row]);
  }

  getCurrentPlayer(): PieceColor {
    return this.gameState.currentPlayer;
  }

  getGameStatus(): string {
    return this.gameState.gameStatus;
  }

  getWinner(): PieceColor | null {
    return this.gameState.winner;
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  getMoveCount(): number {
    return this.gameState.moveCount;
  }

  isValidMove(from: ChessPosition, to: ChessPosition): boolean {
    if (!this.isValidPosition(from) || !this.isValidPosition(to)) return false;
    if (from.row === to.row && from.col === to.col) return false;

    const piece = this.gameState.board[from.row][from.col];
    if (!piece || piece.color !== this.gameState.currentPlayer) return false;

    const targetPiece = this.gameState.board[to.row][to.col];
    if (targetPiece && targetPiece.color === piece.color) return false;

    // Check piece-specific movement rules
    if (!this.isValidPieceMove(piece, from, to)) return false;

    // Check if move would put own king in check
    return !this.wouldMoveExposeKing(from, to);
  }

  private isValidPosition(pos: ChessPosition): boolean {
    return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
  }

  private isValidPieceMove(piece: ChessPiece, from: ChessPosition, to: ChessPosition): boolean {
    const rowDiff = to.row - from.row;
    const colDiff = to.col - from.col;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
      case 'pawn':
        return this.isValidPawnMove(piece, from, to, rowDiff, colDiff);
      case 'rook':
        return (rowDiff === 0 || colDiff === 0) && this.isPathClear(from, to);
      case 'knight':
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      case 'bishop':
        return absRowDiff === absColDiff && this.isPathClear(from, to);
      case 'queen':
        return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && this.isPathClear(from, to);
      case 'king':
        return absRowDiff <= 1 && absColDiff <= 1;
      default:
        return false;
    }
  }

  private isValidPawnMove(piece: ChessPiece, from: ChessPosition, to: ChessPosition, rowDiff: number, colDiff: number): boolean {
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    const targetPiece = this.gameState.board[to.row][to.col];

    // Forward move
    if (colDiff === 0) {
      if (targetPiece) return false; // Can't capture forward
      if (rowDiff === direction) return true; // One square forward
      if (from.row === startRow && rowDiff === 2 * direction) return true; // Two squares from start
    }
    
    // Diagonal capture
    if (Math.abs(colDiff) === 1 && rowDiff === direction) {
      return targetPiece !== null || this.isEnPassantCapture(from, to);
    }

    return false;
  }

  private isEnPassantCapture(from: ChessPosition, to: ChessPosition): boolean {
    return this.gameState.enPassantTarget !== null &&
           to.row === this.gameState.enPassantTarget.row &&
           to.col === this.gameState.enPassantTarget.col;
  }

  private isPathClear(from: ChessPosition, to: ChessPosition): boolean {
    const rowStep = Math.sign(to.row - from.row);
    const colStep = Math.sign(to.col - from.col);
    
    let currentRow = from.row + rowStep;
    let currentCol = from.col + colStep;
    
    while (currentRow !== to.row || currentCol !== to.col) {
      if (this.gameState.board[currentRow][currentCol] !== null) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  }

  private wouldMoveExposeKing(from: ChessPosition, to: ChessPosition): boolean {
    // Make temporary move
    const originalPiece = this.gameState.board[to.row][to.col];
    const movingPiece = this.gameState.board[from.row][from.col];
    
    this.gameState.board[to.row][to.col] = movingPiece;
    this.gameState.board[from.row][from.col] = null;
    
    // Update king position if king moved
    let kingPos = this.gameState.kingPositions[this.gameState.currentPlayer];
    if (movingPiece?.type === 'king') {
      kingPos = to;
    }
    
    const inCheck = this.isPositionUnderAttack(kingPos, this.getOpponentColor(this.gameState.currentPlayer));
    
    // Restore board
    this.gameState.board[from.row][from.col] = movingPiece;
    this.gameState.board[to.row][to.col] = originalPiece;
    
    return inCheck;
  }

  private isPositionUnderAttack(position: ChessPosition, byColor: PieceColor): boolean {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col];
        if (piece && piece.color === byColor) {
          if (this.canPieceAttackPosition(piece, { row, col }, position)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private canPieceAttackPosition(piece: ChessPiece, from: ChessPosition, target: ChessPosition): boolean {
    const rowDiff = target.row - from.row;
    const colDiff = target.col - from.col;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
      case 'pawn':
        const direction = piece.color === 'white' ? -1 : 1;
        return rowDiff === direction && absColDiff === 1;
      case 'rook':
        return (rowDiff === 0 || colDiff === 0) && this.isPathClear(from, target);
      case 'knight':
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      case 'bishop':
        return absRowDiff === absColDiff && this.isPathClear(from, target);
      case 'queen':
        return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && this.isPathClear(from, target);
      case 'king':
        return absRowDiff <= 1 && absColDiff <= 1;
      default:
        return false;
    }
  }

  makeMove(from: ChessPosition, to: ChessPosition): boolean {
    if (!this.isValidMove(from, to)) return false;

    const piece = this.gameState.board[from.row][from.col]!;
    const capturedPiece = this.gameState.board[to.row][to.col];
    
    // Handle en passant capture
    if (piece.type === 'pawn' && this.isEnPassantCapture(from, to)) {
      const capturedPawnRow = piece.color === 'white' ? to.row + 1 : to.row - 1;
      this.gameState.board[capturedPawnRow][to.col] = null;
    }
    
    // Make the move
    this.gameState.board[to.row][to.col] = piece;
    this.gameState.board[from.row][from.col] = null;
    piece.hasMoved = true;
    
    // Update king position
    if (piece.type === 'king') {
      this.gameState.kingPositions[piece.color] = to;
    }
    
    // Handle pawn promotion
    if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
      this.gameState.board[to.row][to.col] = { type: 'queen', color: piece.color, hasMoved: true };
    }
    
    // Set en passant target
    this.gameState.enPassantTarget = null;
    if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
      this.gameState.enPassantTarget = {
        row: (from.row + to.row) / 2,
        col: to.col
      };
    }
    
    // Update fifty-move rule
    if (piece.type === 'pawn' || capturedPiece) {
      this.gameState.fiftyMoveRule = 0;
    } else {
      this.gameState.fiftyMoveRule++;
    }
    
    // Add move to history
    const moveNotation = this.getMoveNotation(piece, from, to, capturedPiece !== null);
    this.gameState.moveHistory.push(moveNotation);
    this.gameState.moveCount++;
    
    // Switch players
    this.gameState.currentPlayer = this.getOpponentColor(this.gameState.currentPlayer);
    
    // Check game status
    this.updateGameStatus();
    
    return true;
  }

  private getMoveNotation(piece: ChessPiece, from: ChessPosition, to: ChessPosition, isCapture: boolean): string {
    const pieceSymbol = piece.type === 'pawn' ? '' : piece.type.charAt(0).toUpperCase();
    const fromSquare = String.fromCharCode(97 + from.col) + (8 - from.row);
    const toSquare = String.fromCharCode(97 + to.col) + (8 - to.row);
    const captureSymbol = isCapture ? 'x' : '';
    
    return `${pieceSymbol}${fromSquare}${captureSymbol}${toSquare}`;
  }

  private updateGameStatus(): void {
    const currentColor = this.gameState.currentPlayer;
    const kingPos = this.gameState.kingPositions[currentColor];
    const inCheck = this.isPositionUnderAttack(kingPos, this.getOpponentColor(currentColor));
    
    const hasValidMoves = this.hasValidMoves(currentColor);
    
    if (!hasValidMoves) {
      if (inCheck) {
        this.gameState.gameStatus = 'checkmate';
        this.gameState.winner = this.getOpponentColor(currentColor);
      } else {
        this.gameState.gameStatus = 'stalemate';
        this.gameState.winner = null;
      }
    } else if (inCheck) {
      this.gameState.gameStatus = 'check';
    } else if (this.gameState.fiftyMoveRule >= 50) {
      this.gameState.gameStatus = 'draw';
      this.gameState.winner = null;
    } else {
      this.gameState.gameStatus = 'playing';
    }
  }

  private hasValidMoves(color: PieceColor): boolean {
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = this.gameState.board[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (this.isValidMove({ row: fromRow, col: fromCol }, { row: toRow, col: toCol })) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  private getOpponentColor(color: PieceColor): PieceColor {
    return color === 'white' ? 'black' : 'white';
  }

  getAllValidMoves(color: PieceColor): { from: ChessPosition; to: ChessPosition }[] {
    const moves: { from: ChessPosition; to: ChessPosition }[] = [];
    
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = this.gameState.board[fromRow][fromCol];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              const from = { row: fromRow, col: fromCol };
              const to = { row: toRow, col: toCol };
              if (this.isValidMove(from, to)) {
                moves.push({ from, to });
              }
            }
          }
        }
      }
    }
    
    return moves;
  }

  isGameOver(): boolean {
    return this.gameState.gameStatus === 'checkmate' || 
           this.gameState.gameStatus === 'stalemate' || 
           this.gameState.gameStatus === 'draw';
  }

  resetGame(): void {
    this.gameState = this.initializeGame();
  }
}

export { ChessGame as default };