import { Trophy, Star, Ghost } from 'lucide-react';
import { Player } from '../lib/api';
import { getGhostColorHex } from '../core/Ghost';

interface ScoreboardScreenProps {
  players: Player[];
  gameNumber: number;
  totalGames: number;
  lastGameResults?: Array<{ player_id: string; player_name: string; rank: number; points: number }>;
  onContinue: () => void;
  isFinalScores?: boolean;
}

export default function ScoreboardScreen({
  players,
  gameNumber,
  totalGames,
  lastGameResults,
  onContinue,
  isFinalScores = false
}: ScoreboardScreenProps) {
  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Trophy className="w-20 h-20 text-yellow-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">
            {isFinalScores ? 'Resultado Final!' : `Jogo ${gameNumber} de ${totalGames}`}
          </h1>
          <p className="text-purple-200 text-xl">
            {isFinalScores ? 'Parabéns ao vencedor!' : 'Placar Parcial'}
          </p>
        </div>

        {lastGameResults && !isFinalScores && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              Pontos do Último Jogo
            </h2>
            <div className="space-y-2">
              {lastGameResults.slice().sort((a, b) => a.rank - b.rank).map((result) => {
                const player = players.find(p => p.id === result.player_id);
                return (
                  <div
                    key={result.player_id}
                    className="bg-white/5 backdrop-blur rounded-lg p-3 flex items-center gap-4"
                  >
                    <span className="text-2xl font-bold text-purple-300 w-12 text-center">
                      {getRankEmoji(result.rank)}
                    </span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: player ? getGhostColorHex(player.ghost_color as any) : '#666' }}
                    >
                      <Ghost className="w-6 h-6 text-white" strokeWidth={2} />
                    </div>
                    <span className="text-white font-bold flex-1">{result.player_name}</span>
                    <span className="text-yellow-400 font-bold text-xl">+{result.points}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            {isFinalScores ? 'Classificação Final' : 'Placar Geral'}
          </h2>

          <div className="space-y-3">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`backdrop-blur rounded-xl p-5 flex items-center gap-4 transition-all ${
                  index === 0
                    ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-400/50 shadow-lg shadow-yellow-500/20'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <div className="text-3xl font-bold text-purple-300 w-16 text-center">
                  {getRankEmoji(index + 1)}
                </div>

                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: getGhostColorHex(player.ghost_color as any) }}
                >
                  <Ghost className="w-8 h-8 text-white" strokeWidth={2} />
                </div>

                <div className="flex-1">
                  <p className="text-white font-bold text-xl">{player.player_name}</p>
                  <p className="text-purple-200 text-sm capitalize">{player.ghost_color} Ghost</p>
                </div>

                <div className="text-right">
                  <p className="text-white font-bold text-3xl">{player.total_score}</p>
                  <p className="text-purple-200 text-sm">pontos</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onContinue}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-12 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30 text-xl"
          >
            {isFinalScores ? 'Voltar ao Menu' : 'Próximo Jogo'}
          </button>
        </div>
      </div>
    </div>
  );
}
