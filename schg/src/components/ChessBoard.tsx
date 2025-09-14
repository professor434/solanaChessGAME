import React from 'react';
import { ChessPiece, PieceColor, ChessPosition } from '@/lib/chess-logic';

interface ChessBoardProps {
  board: (ChessPiece | null)[][];
  onSquareClick: (row: number, col: number) => void;
  selectedSquare: ChessPosition | null;
  currentPlayer: PieceColor;
}

export default function ChessBoard({ board, onSquareClick, selectedSquare, currentPlayer }: ChessBoardProps) {
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

  const isSquareDark = (row: number, col: number): boolean => {
    return (row + col) % 2 === 1;
  };

  const getSquareClasses = (row: number, col: number): string => {
    const baseClasses = 'w-12 h-12 md:w-16 md:h-16 flex items-center justify-center text-2xl md:text-4xl cursor-pointer transition-colors border';
    
    let colorClasses = '';
    if (isSquareDark(row, col)) {
      colorClasses = isSquareSelected(row, col) 
        ? 'bg-blue-600 text-white' 
        : 'bg-amber-700 hover:bg-amber-600 text-white';
    } else {
      colorClasses = isSquareSelected(row, col) 
        ? 'bg-blue-400 text-black' 
        : 'bg-amber-100 hover:bg-amber-200 text-black';
    }
    
    return `${baseClasses} ${colorClasses}`;
  };

  // Ensure we have a valid board
  if (!board || !Array.isArray(board) || board.length !== 8) {
    return (
      <div className="flex items-center justify-center w-96 h-96 md:w-128 md:h-128 bg-gray-200 rounded-lg">
        <div className="text-center">
          <div className="text-2xl mb-2">♔</div>
          <div className="text-gray-600">Loading chess board...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-block p-4 bg-amber-900 rounded-lg shadow-2xl">
      {/* Column labels */}
      <div className="flex mb-1">
        <div className="w-6"></div>
        {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((label) => (
          <div key={label} className="w-12 md:w-16 text-center text-amber-100 text-sm font-semibold">
            {label}
          </div>
        ))}
      </div>
      
      <div className="border-2 border-amber-800 rounded">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {/* Row label */}
            <div className="w-6 flex items-center justify-center text-amber-100 text-sm font-semibold">
              {8 - rowIndex}
            </div>
            
            {row.map((piece, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={getSquareClasses(rowIndex, colIndex)}
                onClick={() => onSquareClick(rowIndex, colIndex)}
                type="button"
              >
                {getPieceSymbol(piece)}
              </button>
            ))}
          </div>
        ))}
      </div>
      
      {/* Current player indicator */}
      <div className="mt-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-800 rounded-full text-amber-100 text-sm font-medium">
          <div className="w-3 h-3 rounded-full bg-current"></div>
          <span>{currentPlayer === 'white' ? 'White' : 'Black'} to move</span>
        </div>
      </div>
    </div>
  );
}