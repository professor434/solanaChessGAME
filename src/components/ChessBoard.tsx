import React from 'react';
import { ChessPosition, GameState, ChessPiece } from '@/lib/chess-logic';

interface ChessBoardProps {
  gameState: GameState;
  selectedSquare: ChessPosition | null;
  validMoves: ChessPosition[];
  onSquareClick: (position: ChessPosition) => void;
  isFlipped?: boolean;
}

// Enhanced chess piece components with beautiful SVG graphics
const ChessPieceComponent: React.FC<{ piece: ChessPiece; size?: number }> = ({ piece, size = 40 }) => {
  const pieceStyles = {
    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
    transition: 'all 0.2s ease-in-out',
  };

  const getPieceSymbol = (piece: ChessPiece) => {
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
    return symbols[piece.color][piece.type];
  };

  return (
    <div 
      className="flex items-center justify-center w-full h-full select-none"
      style={pieceStyles}
    >
      <span 
        className={`text-4xl font-bold ${piece.color === 'white' ? 'text-white' : 'text-gray-900'}`}
        style={{ 
          textShadow: piece.color === 'white' 
            ? '1px 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)' 
            : '1px 1px 2px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.3)',
          fontSize: `${size}px`,
          lineHeight: '1'
        }}
      >
        {getPieceSymbol(piece)}
      </span>
    </div>
  );
};

export default function ChessBoard({ gameState, selectedSquare, validMoves, onSquareClick, isFlipped = false }: ChessBoardProps) {
  const isSquareSelected = (row: number, col: number) => {
    return selectedSquare?.row === row && selectedSquare?.col === col;
  };

  const isValidMove = (row: number, col: number) => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const getSquareColor = (row: number, col: number) => {
    const isLight = (row + col) % 2 === 0;
    const isSelected = isSquareSelected(row, col);
    const isValid = isValidMove(row, col);
    
    if (isSelected) {
      return isLight ? 'bg-yellow-300' : 'bg-yellow-400';
    }
    
    if (isValid) {
      return isLight ? 'bg-green-200' : 'bg-green-300';
    }
    
    return isLight ? 'bg-amber-100' : 'bg-amber-800';
  };

  const renderSquare = (row: number, col: number) => {
    const displayRow = isFlipped ? 7 - row : row;
    const displayCol = isFlipped ? 7 - col : col;
    const piece = gameState.board[row]?.[col];
    
    return (
      <div
        key={`${row}-${col}`}
        className={`
          w-16 h-16 flex items-center justify-center cursor-pointer relative
          border border-amber-900/20 transition-all duration-200 hover:brightness-110
          ${getSquareColor(row, col)}
        `}
        onClick={() => onSquareClick({ row, col })}
        style={{
          boxShadow: isSquareSelected(row, col) 
            ? 'inset 0 0 0 3px rgba(59, 130, 246, 0.8)' 
            : isValidMove(row, col)
            ? 'inset 0 0 0 2px rgba(34, 197, 94, 0.6)'
            : 'inset 0 1px 2px rgba(0,0,0,0.1)'
        }}
      >
        {piece && <ChessPieceComponent piece={piece} size={45} />}
        
        {/* Valid move indicator */}
        {isValidMove(row, col) && !piece && (
          <div className="w-4 h-4 bg-green-500 rounded-full opacity-60" />
        )}
        
        {/* Capture indicator */}
        {isValidMove(row, col) && piece && (
          <div className="absolute inset-0 border-4 border-red-500 rounded-lg opacity-60" />
        )}
        
        {/* Coordinates */}
        {col === 0 && (
          <div className="absolute left-1 top-1 text-xs font-bold text-amber-900 opacity-60">
            {8 - displayRow}
          </div>
        )}
        {row === 7 && (
          <div className="absolute right-1 bottom-1 text-xs font-bold text-amber-900 opacity-60">
            {String.fromCharCode(97 + displayCol)}
          </div>
        )}
      </div>
    );
  };

  const renderBoard = () => {
    const squares = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        squares.push(renderSquare(row, col));
      }
    }
    return squares;
  };

  return (
    <div className="inline-block p-4 bg-gradient-to-br from-amber-900 to-amber-700 rounded-xl shadow-2xl">
      <div 
        className="grid grid-cols-8 gap-0 border-4 border-amber-900 rounded-lg overflow-hidden"
        style={{
          transform: isFlipped ? 'rotate(180deg)' : 'none',
        }}
      >
        {renderBoard()}
      </div>
      
      {/* Game info */}
      <div className="mt-4 text-center">
        <div className="text-amber-100 text-sm font-medium">
          Current Turn: <span className="capitalize font-bold">{gameState.currentPlayer}</span>
        </div>
        {gameState.isCheck && (
          <div className="text-red-300 text-sm font-bold mt-1 animate-pulse">
            ⚠️ Check!
          </div>
        )}
      </div>
    </div>
  );
}
