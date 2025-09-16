import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, ArrowLeft, Crown, Bot, Users } from 'lucide-react';
import { GameRoom } from '@/lib/solana-integration';

interface GameResultsProps {
  result: string;
  playerColor: 'white' | 'black';
  gameRoom?: GameRoom | null;
  moveHistory: string[];
  onBackToLobby: () => void;
  gameMode: 'multiplayer' | 'bot';
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

export default function GameResults({ 
  result, 
  playerColor, 
  gameRoom, 
  moveHistory, 
  onBackToLobby, 
  gameMode,
  botDifficulty = 'medium'
}: GameResultsProps) {
  const isWin = result.toLowerCase().includes('win') || 
               (result.toLowerCase().includes('checkmate') && 
                ((result.toLowerCase().includes('white') && playerColor === 'white') ||
                 (result.toLowerCase().includes('black') && playerColor === 'black')));
  
  const isDraw = result.toLowerCase().includes('draw') || result.toLowerCase().includes('stalemate');
  const isLoss = !isWin && !isDraw;

  const getResultIcon = () => {
    if (isWin) return <Trophy className="h-8 w-8 text-yellow-500" />;
    if (isDraw) return <Crown className="h-8 w-8 text-gray-500" />;
    return <Trophy className="h-8 w-8 text-gray-400" />;
  };

  const getResultColor = () => {
    if (isWin) return 'text-green-600';
    if (isDraw) return 'text-gray-600';
    return 'text-red-600';
  };

  const getResultBg = () => {
    if (isWin) return 'bg-green-50 border-green-200';
    if (isDraw) return 'bg-gray-50 border-gray-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Result Card */}
        <Card className={`${getResultBg()} border-2`}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getResultIcon()}
            </div>
            <CardTitle className={`text-2xl ${getResultColor()}`}>
              {isWin ? 'Victory!' : isDraw ? 'Draw!' : 'Defeat!'}
            </CardTitle>
            <p className="text-lg text-gray-600 mt-2">
              {result}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Info */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-500">Game Mode</div>
                <Badge variant="outline" className="mt-1">
                  {gameMode === 'bot' ? (
                    <><Bot className="h-3 w-3 mr-1" /> vs {botDifficulty} Bot</>
                  ) : (
                    <><Users className="h-3 w-3 mr-1" /> Multiplayer</>
                  )}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-gray-500">Your Color</div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {playerColor}
                </Badge>
              </div>
            </div>

            {/* Multiplayer Prize Info */}
            {gameMode === 'multiplayer' && gameRoom && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center space-y-2">
                  <div className="text-sm text-gray-500">Prize Pool</div>
                  <div className="text-xl font-bold text-purple-600">
                    {(gameRoom.entranceFee * 2).toFixed(4)} SOL
                  </div>
                  {isWin && (
                    <div className="text-green-600 font-medium">
                      You won {(gameRoom.entranceFee * 1.8).toFixed(4)} SOL!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bot Game Info */}
            {gameMode === 'bot' && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center space-y-2">
                  <div className="text-sm text-gray-500">Practice Game</div>
                  <div className="text-green-600 font-medium">
                    Free game • Stats recorded
                  </div>
                  <div className="text-sm text-gray-500">
                    Difficulty: <span className="capitalize font-medium">{botDifficulty}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Game Stats */}
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Game Statistics</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">{moveHistory.length}</div>
                    <div className="text-gray-500">Total Moves</div>
                  </div>
                  <div>
                    <div className="font-medium">{Math.ceil(moveHistory.length / 2)}</div>
                    <div className="text-gray-500">Game Turns</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Move History */}
        {moveHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Move History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                  {moveHistory.map((move, index) => (
                    <div key={index} className="py-1">
                      {Math.floor(index / 2) + 1}. {move}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button 
            onClick={onBackToLobby}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
