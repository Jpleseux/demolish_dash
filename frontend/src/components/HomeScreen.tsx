import { useState } from 'react';
import { Ghost, Users } from 'lucide-react';

interface HomeScreenProps {
  onCreateRoom: (hostName: string, minPlayers: number, maxGames: number) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
}

export default function HomeScreen({ onCreateRoom, onJoinRoom }: HomeScreenProps) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxGames, setMaxGames] = useState(5);
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    if (!name.trim()) {
      setError('Por favor, insira seu nome');
      return;
    }
    setError('');
    onCreateRoom(name.trim(), minPlayers, maxGames);
  };

  const handleJoinRoom = () => {
    if (!name.trim()) {
      setError('Por favor, insira seu nome');
      return;
    }
    if (!roomCode.trim()) {
      setError('Por favor, insira o código da sala');
      return;
    }
    setError('');
    onJoinRoom(roomCode.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Ghost className="w-20 h-20 text-purple-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">Ghost Party</h1>
          <p className="text-purple-200">Diversão assombrada com amigos!</p>
        </div>

        {mode === 'menu' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl mb-4 transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <Users className="w-6 h-6" />
              Criar Sala
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white/20 hover:bg-white/30 backdrop-blur text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <Ghost className="w-6 h-6" />
              Entrar na Sala
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Criar Nova Sala</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-200 text-sm font-semibold mb-2">
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Digite seu nome"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-semibold mb-2">
                  Jogadores Mínimos: {minPlayers}
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-semibold mb-2">
                  Número de Jogos: {maxGames}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxGames}
                  onChange={(e) => setMaxGames(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {error && (
                <p className="text-red-300 text-sm bg-red-500/20 p-3 rounded-lg">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMode('menu'); setError(''); }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-lg transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCreateRoom}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Entrar na Sala</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-200 text-sm font-semibold mb-2">
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Digite seu nome"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-semibold mb-2">
                  Código da Sala
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-center text-2xl tracking-wider font-bold"
                  placeholder="XXXXXX"
                  maxLength={6}
                />
              </div>

              {error && (
                <p className="text-red-300 text-sm bg-red-500/20 p-3 rounded-lg">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMode('menu'); setError(''); }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-lg transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
                >
                  Entrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
