import React from 'react';
import { ChessPiece, PieceColor, ChessPosition, GameState } from '@/lib/chess-logic';

interface ChessBoardProps {
  gameState: GameState;
  selectedSquare: ChessPosition | null;
  validMoves: ChessPosition[];
  onSquareClick: (position: ChessPosition) => void;
  isFlipped?: boolean;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
  gameState,
  selectedSquare,
  validMoves,
  onSquareClick,
  isFlipped = false
}) => {
  const getPieceSymbol = (piece: ChessPiece | null): string => {
    if (!piece) return '';
    
    const symbols = {
      white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
      },
      black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
      }
    };
    
    return symbols[piece.color][piece.type] || '';
  };

  const isSquareSelected = (row: number, col: number): boolean => {
    return selectedSquare?.row === row && selectedSquare?.col === col;
  };

  const isValidMove = (row: number, col: number): boolean => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const getSquareColor = (row: number, col: number): string => {
    const isLight = (row + col) % 2 === 0;
    
    if (isSquareSelected(row, col)) {
      return isLight ? 'bg-blue-300' : 'bg-blue-400';
    }
    
    if (isValidMove(row, col)) {
      return isLight ? 'bg-green-200' : 'bg-green-300';
    }
    
    return isLight ? 'bg-amber-100' : 'bg-amber-800';
  };

  const renderSquare = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    const position: ChessPosition = { row, col };
    
    return (
      <div
        key={`${row}-${col}`}
        className={`
          w-12 h-12 md:w-16 md:h-16 flex items-center justify-center text-2xl md:text-4xl cursor-pointer
          hover:bg-opacity-80 transition-colors duration-150 border border-amber-900
          ${getSquareColor(row, col)}
          ${isValidMove(row, col) ? 'ring-2 ring-green-500' : ''}
          ${isSquareSelected(row, col) ? 'ring-2 ring-blue-500' : ''}
        `}
        onClick={() => onSquareClick(position)}
      >
        <span className="select-none pointer-events-none">
          {getPieceSymbol(piece)}
        </span>
        
        {/* Show valid move indicators */}
        {isValidMove(row, col) && !piece && (
          <div className="absolute w-3 h-3 bg-green-600 rounded-full opacity-60" />
        )}
      </div>
    );
  };

  // Create board display - flip if needed
  const displayRows = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="inline-block p-4 bg-amber-900 rounded-lg shadow-lg">
      {/* Column labels (files) */}
      <div className="flex mb-2">
        <div className="w-6"></div>
        {displayCols.map(col => (
          <div key={col} className="w-12 md:w-16 text-center text-sm font-medium text-amber-100">
            {String.fromCharCode(97 + col).toUpperCase()}
          </div>
        ))}
      </div>
      
      <div className="relative">
        {/* Chess board grid */}
        <div className="border-2 border-amber-800 rounded">
          {displayRows.map(row => (
            <div key={row} className="flex">
              {/* Row label (rank) */}
              <div className="w-6 flex items-center justify-center text-sm font-medium text-amber-100">
                {8 - row}
              </div>
              {displayCols.map(col => renderSquare(row, col))}
            </div>
          ))}
        </div>
      </div>

      {/* Current player indicator */}
      <div className="mt-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-800 rounded-full text-amber-100 text-sm font-medium">
          <div className={`w-3 h-3 rounded-full ${gameState.currentPlayer === 'white' ? 'bg-white' : 'bg-gray-800'}`}></div>
          <span>{gameState.currentPlayer === 'white' ? 'White' : 'Black'} to move</span>
        </div>
      </div>
    </div>
  );
};

export default ChessBoard;