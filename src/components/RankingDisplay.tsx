import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Crown, Star, Gift, Calendar, Users, TrendingUp } from 'lucide-react';
import { rankingSystem, PlayerRank, AnnualTournament, RANKS } from '@/lib/ranking-system';

interface RankingDisplayProps {
  playerPublicKey: string;
  onClose: () => void;
}

export default function RankingDisplay({ playerPublicKey, onClose }: RankingDisplayProps) {
  const [playerRank, setPlayerRank] = useState<PlayerRank | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerRank[]>([]);
  const [currentTournament, setCurrentTournament] = useState<AnnualTournament | null>(null);
  const [tournamentHistory, setTournamentHistory] = useState<AnnualTournament[]>([]);

  useEffect(() => {
    loadData();
  }, [playerPublicKey]);

  const loadData = () => {
    const player = rankingSystem.getPlayerRank(playerPublicKey);
    const leaders = rankingSystem.getLeaderboard(50);
    const tournament = rankingSystem.getCurrentTournament();
    const history = rankingSystem.getTournamentHistory();

    setPlayerRank(player);
    setLeaderboard(leaders);
    setCurrentTournament(tournament);
    setTournamentHistory(history);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rankName: string) => {
    const icons: Record<string, string> = {
      'Pawn': '♟️',
      'Knight': '♞',
      'Bishop': '♝',
      'Rook': '♜',
      'Queen': '♛',
      'King': '♚',
      'Grandmaster': '👑',
      'Legend': '⭐'
    };
    return icons[rankName] || '♟️';
  };

  const getNextRank = (currentRank: string) => {
    const currentIndex = RANKS.findIndex(r => r.name === currentRank);
    return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
  };

  if (!playerRank) {
    return <div>Loading...</div>;
  }

  const nextRank = getNextRank(playerRank.currentRank);
  const rankColor = rankingSystem.getRankColor(playerRank.currentRank);
  const playerLeaderboardPosition = leaderboard.findIndex(p => p.publicKey === playerPublicKey) + 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-600" />
              Player Rankings
            </h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="tournament">Tournament</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              {/* Player Profile */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: rankColor }}
                    >
                      {getRankIcon(playerRank.currentRank)}
                    </div>
                    {formatAddress(playerRank.publicKey)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rank Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: rankColor }}>
                        {playerRank.currentRank}
                      </div>
                      <div className="text-sm text-gray-600">Current Rank</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{playerRank.elo}</div>
                      <div className="text-sm text-gray-600">ELO Rating</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">#{playerLeaderboardPosition || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Global Rank</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{playerRank.totalGames}</div>
                      <div className="text-sm text-gray-600">Games Played</div>
                    </div>
                  </div>

                  {/* Rank Progress */}
                  {nextRank && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress to {nextRank.name}</span>
                        <span>{playerRank.rankProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={playerRank.rankProgress} className="h-2" />
                      <div className="text-xs text-gray-500">
                        Need {nextRank.gamesRequired} games and {nextRank.minElo} ELO
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-green-600">{playerRank.wins}</div>
                      <div className="text-sm text-gray-600">Wins</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">{playerRank.losses}</div>
                      <div className="text-sm text-gray-600">Losses</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-600">{playerRank.draws}</div>
                      <div className="text-sm text-gray-600">Draws</div>
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="text-center">
                    <div className="text-lg font-bold">
                      {playerRank.totalGames > 0 ? ((playerRank.wins / playerRank.totalGames) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-gray-600">Win Rate</div>
                  </div>

                  {/* Achievements */}
                  <div>
                    <h3 className="font-semibold mb-2">Achievements ({playerRank.achievements.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {playerRank.achievements.map((achievementId) => {
                        const achievement = rankingSystem.getAchievementInfo(achievementId);
                        return achievement ? (
                          <Badge key={achievementId} variant="secondary" className="flex items-center gap-1">
                            <span>{achievement.icon}</span>
                            <span>{achievement.name}</span>
                          </Badge>
                        ) : null;
                      })}
                      {playerRank.achievements.length === 0 && (
                        <div className="text-gray-500 text-sm">No achievements yet</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Global Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 20).map((player, index) => (
                      <div 
                        key={player.publicKey}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          player.publicKey === playerPublicKey ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center font-bold">
                            {index + 1 <= 3 ? (
                              <span className={index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600'}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              index + 1
                            )}
                          </div>
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: rankingSystem.getRankColor(player.currentRank) }}
                          >
                            {getRankIcon(player.currentRank)}
                          </div>
                          <div>
                            <div className="font-medium">{formatAddress(player.publicKey)}</div>
                            <div className="text-sm text-gray-600">{player.currentRank}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{player.elo}</div>
                          <div className="text-sm text-gray-600">{player.wins}W-{player.losses}L</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tournament" className="space-y-4">
              {currentTournament ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-600" />
                      Annual Tournament {currentTournament.year}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{currentTournament.participants.length}</div>
                        <div className="text-sm text-gray-600">Participants</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {currentTournament.participants.find(p => p.publicKey === playerPublicKey) ? 'Joined' : 'Not Joined'}
                        </div>
                        <div className="text-sm text-gray-600">Your Status</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {Math.ceil((currentTournament.endDate - Date.now()) / (1000 * 60 * 60 * 24))}
                        </div>
                        <div className="text-sm text-gray-600">Days Left</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Mystery Prizes
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Badge variant="outline" className="justify-center p-2">
                          🥇 {currentTournament.mysteryPrizes.first}
                        </Badge>
                        <Badge variant="outline" className="justify-center p-2">
                          🥈 {currentTournament.mysteryPrizes.second}
                        </Badge>
                        <Badge variant="outline" className="justify-center p-2">
                          🥉 {currentTournament.mysteryPrizes.third}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Top 10 Tournament Leaders</h3>
                      <div className="space-y-2">
                        {currentTournament.participants
                          .sort((a, b) => b.finalElo - a.finalElo)
                          .slice(0, 10)
                          .map((participant, index) => (
                            <div 
                              key={participant.publicKey}
                              className={`flex items-center justify-between p-2 rounded ${
                                participant.publicKey === playerPublicKey ? 'bg-blue-50' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 text-center font-bold">#{index + 1}</span>
                                <span>{formatAddress(participant.publicKey)}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{participant.finalElo} ELO</div>
                                <div className="text-sm text-gray-600">{participant.totalWins} wins</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Tournament</h3>
                    <p className="text-gray-600">The annual tournament will start on January 1st!</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Medal className="h-5 w-5" />
                    Tournament History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tournamentHistory.length > 0 ? (
                    <div className="space-y-4">
                      {tournamentHistory.map((tournament) => (
                        <div key={tournament.year} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">Tournament {tournament.year}</h3>
                            <Badge variant={tournament.isActive ? "default" : "secondary"}>
                              {tournament.isActive ? 'Active' : 'Completed'}
                            </Badge>
                          </div>
                          
                          {!tournament.isActive && tournament.participants.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Winners:</h4>
                              <div className="space-y-1">
                                {tournament.participants.slice(0, 3).map((winner, index) => (
                                  <div key={winner.publicKey} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                      <span>{formatAddress(winner.publicKey)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span>{winner.finalElo} ELO</span>
                                      {winner.mysteryPrizeWon && (
                                        <Badge variant="outline" className="text-xs">
                                          🎁 {winner.mysteryPrizeWon}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No tournament history available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}