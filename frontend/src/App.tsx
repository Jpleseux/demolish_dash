import { useEffect, useState } from 'react';
import { Room, Player, GameSession } from './lib/api';
import { RoomManager } from './core/Room';
import { GameManager, GameResult } from './core/GameManager';
import HomeScreen from './components/HomeScreen';
import LobbyScreen from './components/LobbyScreen';
import TagBombGame from './games/tag-bomb/TagBombGame';
import PlatformPushGame from './games/platform-push/PlatformPushGame';
import ScoreboardScreen from './components/ScoreboardScreen';
import BoulderRunGame from './games/boulder-run/BoulderRunGame';
import FallingTilesGame from './games/falling_tiles/FallingTilesGame';

type AppState = 'home' | 'lobby' | 'playing' | 'scoreboard' | 'final';

function App() {
  const [appState, setAppState] = useState<AppState>('home');
  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentGame, setCurrentGame] = useState<GameSession | null>(null);
  const [lastGameResults, setLastGameResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!room) return;

    const fetchPlayers = async () => {
      const fetchedPlayers = await RoomManager.getPlayers(room.id);
      setPlayers(fetchedPlayers);
    };

    fetchPlayers();

    const channel = RoomManager.subscribeToRoom(room.id, () => {
      fetchPlayers();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [room]);

  useEffect(() => {
    if (!room || appState !== 'lobby') return;

    let isMounted = true;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let unsubscribe: (() => void) | null = null;

    const checkStatus = async () => {
      if (!isMounted || !room || !room.room_code || !room.id) return;

      const currentRoomCode = room.room_code.trim().toUpperCase();
      if (currentRoomCode.length !== 6) {
        return;
      }

      try {
        const updatedRoom = await RoomManager.getRoomByCode(currentRoomCode);
        if (!updatedRoom || !isMounted) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
            return;
          }
          return;
        }

        consecutiveErrors = 0;

        if (updatedRoom.id !== room.id) {
          return;
        }

        setRoom(updatedRoom);

        if (updatedRoom.status === 'playing') {
          let activeGame = await GameManager.getCurrentGame(updatedRoom.id);
          if (!activeGame) {
            activeGame = await GameManager.getNextGame(updatedRoom.id);
            if (activeGame) {
              await GameManager.startGame(activeGame.id);
            }
          }
          if (activeGame && isMounted) {
            setCurrentGame(activeGame);
            setAppState('playing');
            return;
          }
        }
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
          return;
        }
        return;
      }
    };

    if (room.room_code && room.id) {
      checkStatus();
      const channel = RoomManager.subscribeToRoom(room.id, checkStatus);
      unsubscribe = channel.unsubscribe;

      return () => {
        isMounted = false;
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [room?.id, room?.room_code, appState]);

  useEffect(() => {
    if (!room || appState !== 'scoreboard') return;

    const checkNextGame = async () => {
      const channel = GameManager.subscribeToGames(room.id, async () => {
        const activeGame = await GameManager.getCurrentGame(room.id);
        if (activeGame && activeGame.id !== currentGame?.id) {
          setCurrentGame(activeGame);
          setAppState('playing');
        }
      });

      return () => {
        channel.unsubscribe();
      };
    };

    checkNextGame();
  }, [room, appState, currentGame]);

  const handleCreateRoom = async (hostName: string, minPlayers: number, maxGames: number) => {
    setLoading(true);
    const result = await RoomManager.createRoom(hostName, minPlayers, maxGames);

    if (result) {
      setRoom(result.room);
      setCurrentPlayer(result.player);
      await GameManager.createGameSessions(result.room.id, maxGames);
      setAppState('lobby');
    } else {
      alert('Erro ao criar sala. Tente novamente.');
    }
    setLoading(false);
  };

  const handleJoinRoom = async (roomCode: string, playerName: string) => {
    setLoading(true);
    try {
      const roomCodeUpper = roomCode.trim().toUpperCase();
      const result = await RoomManager.joinRoom(roomCodeUpper, playerName);

      if (result && result.room && result.room.id && result.room.room_code) {
        setRoom(result.room);
        setCurrentPlayer(result.player);
        setAppState('lobby');
      } else {
        alert('Sala não encontrada, está cheia ou o jogo já começou. Verifique o código.');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Erro ao entrar na sala. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!room || !currentPlayer) return;

    const isHost = players[0]?.id === currentPlayer.id;
    if (!isHost) return;

    setLoading(true);
    await RoomManager.updateRoomStatus(room.id, 'playing');

    const nextGame = await GameManager.getNextGame(room.id);
    if (nextGame) {
      await GameManager.startGame(nextGame.id);
      setCurrentGame(nextGame);
      setAppState('playing');
    }
    setLoading(false);
  };

  const handleGameComplete = async (results: GameResult[]) => {
    if (!currentGame || !room) return;

    await GameManager.completeGame(currentGame.id, results);
    setLastGameResults(results);

    const updatedPlayers = await RoomManager.getPlayers(room.id);
    setPlayers(updatedPlayers);

    const allGames = await GameManager.getAllGames(room.id);
    const completedGames = allGames.filter(g => g.status === 'completed');

    if (completedGames.length >= room.max_games) {
      await RoomManager.updateRoomStatus(room.id, 'finished');
      setAppState('final');
    } else {
      setAppState('scoreboard');
    }
  };

  const handleContinueToNextGame = async () => {
    if (!room) return;

    const nextGame = await GameManager.getNextGame(room.id);
    if (nextGame) {
      await GameManager.startGame(nextGame.id);
      setCurrentGame(nextGame);
      setAppState('playing');
    }
  };

  const handleBackToMenu = () => {
    setAppState('home');
    setRoom(null);
    setCurrentPlayer(null);
    setPlayers([]);
    setCurrentGame(null);
    setLastGameResults([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex items-center justify-center">
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (appState === 'home') {
    return <HomeScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  if (appState === 'lobby' && room && currentPlayer) {
    return (
      <LobbyScreen
        room={room}
        players={players}
        currentPlayerId={currentPlayer.id}
        onStartGame={handleStartGame}
      />
    );
  }

  if (appState === 'playing' && currentGame && currentPlayer) {
    if (currentGame.game_type === 'tag_bomb') {
      return (
        <TagBombGame
          players={players}
          currentPlayerId={currentPlayer.id}
          gameSessionId={currentGame.id}
          onGameComplete={handleGameComplete}
        />
      );
    }

    if (currentGame.game_type === 'platform_push') {
      return (
        <PlatformPushGame
          players={players}
          currentPlayerId={currentPlayer.id}
          gameSessionId={currentGame.id}
          onGameComplete={handleGameComplete}
        />
      );
    }

    if (currentGame.game_type === 'boulder_run') {
      return (
        <BoulderRunGame
          players={players}
          currentPlayerId={currentPlayer.id}
          gameSessionId={currentGame.id}
          onGameComplete={handleGameComplete}
        />
      );
    }

    if (currentGame.game_type === 'falling_tiles') {
      return (
        <FallingTilesGame
          players={players}
          currentPlayerId={currentPlayer.id}
          gameSessionId={currentGame.id}
          onGameComplete={handleGameComplete}
        />
      );
    }
  }

  if (appState === 'scoreboard' && room && currentGame) {
    return (
      <ScoreboardScreen
        players={players}
        gameNumber={currentGame.game_number}
        totalGames={room.max_games}
        lastGameResults={lastGameResults}
        onContinue={handleContinueToNextGame}
      />
    );
  }

  if (appState === 'final' && room) {
    return (
      <ScoreboardScreen
        players={players}
        gameNumber={room.max_games}
        totalGames={room.max_games}
        onContinue={handleBackToMenu}
        isFinalScores
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex items-center justify-center">
      <div className="text-white text-2xl">Erro ao carregar o jogo</div>
    </div>
  );
}

export default App;
