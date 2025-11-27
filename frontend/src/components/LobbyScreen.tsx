import { useEffect, useState } from 'react';
import { Ghost, Copy, Check, Users, Play } from 'lucide-react';
import { Player, Room } from '../lib/api';
import { getGhostColorHex } from '../core/Ghost';

interface LobbyScreenProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  onStartGame: () => void;
}

export default function LobbyScreen({ room, players, currentPlayerId, onStartGame }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const isHost = players[0]?.id === currentPlayerId;
  const canStart = players.length >= room.min_players;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Ghost className="w-16 h-16 text-purple-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Sala de Espera</h1>

          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
            <span className="text-purple-200 text-sm font-semibold">Código:</span>
            <span className="text-white text-3xl font-bold tracking-wider">{room.room_code}</span>
            <button
              onClick={copyRoomCode}
              className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-purple-300" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-purple-300" />
            <h2 className="text-2xl font-bold text-white">
              Jogadores ({players.length}/10)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`bg-white/5 backdrop-blur rounded-xl p-4 border transition-all ${
                  player.id === currentPlayerId
                    ? 'border-purple-400 shadow-lg shadow-purple-500/20'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getGhostColorHex(player.ghost_color as any) }}
                  >
                    <Ghost className="w-7 h-7 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{player.player_name}</p>
                      {index === 0 && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full font-semibold">
                          Host
                        </span>
                      )}
                      {player.id === currentPlayerId && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full font-semibold">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-purple-200 text-sm capitalize">{player.ghost_color}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-white font-bold mb-3">Configurações da Partida</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-purple-200">Jogadores Mínimos</p>
              <p className="text-white font-bold text-lg">{room.min_players}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-purple-200">Número de Jogos</p>
              <p className="text-white font-bold text-lg">{room.max_games}</p>
            </div>
          </div>
        </div>

        {isHost && (
          <div className="text-center">
            {canStart ? (
              <button
                onClick={onStartGame}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 inline-flex items-center gap-3 shadow-lg shadow-purple-500/30"
              >
                <Play className="w-6 h-6" />
                Iniciar Partida
              </button>
            ) : (
              <div className="bg-yellow-500/20 text-yellow-300 py-3 px-6 rounded-xl inline-block">
                Aguardando {room.min_players - players.length} jogador(es)...
              </div>
            )}
          </div>
        )}

        {!isHost && (
          <div className="text-center">
            <p className="text-purple-200">
              {canStart
                ? 'Aguardando o host iniciar a partida...'
                : `Aguardando ${room.min_players - players.length} jogador(es)...`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
