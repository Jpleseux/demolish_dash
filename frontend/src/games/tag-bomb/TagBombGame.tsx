import { useEffect, useRef, useState } from 'react';
import { Player } from '../../lib/api';
import { Ghost, getGhostColorHex } from '../../core/Ghost';
import { gameSocket } from '../../core/GameSocket';
import { Zap, Bomb } from 'lucide-react';

interface TagBombGameProps {
  players: Player[];
  currentPlayerId: string;
  gameSessionId: string;
  onGameComplete: (results: Array<{ player_id: string; player_name: string; rank: number; points: number }>) => void;
}

interface GameState {
  ghosts: Map<string, Ghost>;
  bombHolderId: string | null;
  bombTimer: number;
  eliminatedPlayers: string[];
  gameStartTime: number;
  bombPassCooldown: number;
  lastBombPassTime: number;
  gameCompleted: boolean;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default function TagBombGame({ players, currentPlayerId, gameSessionId, onGameComplete }: TagBombGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const [bombTimer, setBombTimer] = useState(30);
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const [dashReady, setDashReady] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lastTimeRef.current = 0;
    canvas.width = 800;
    canvas.height = 600;

    if (players.length < 2) {
      const results = players.map((player) => ({
        player_id: player.id,
        player_name: player.player_name,
        rank: 1,
        points: 1
      }));
      onGameComplete(results);
      return;
    }

    const ghosts = new Map<string, Ghost>();
    const gridCols = Math.ceil(Math.sqrt(players.length));
    const spacing = 150;

    players.forEach((player, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);
      const x = 150 + col * spacing;
      const y = 150 + row * spacing;

      const ghost = new Ghost(player.id, player.player_name, player.ghost_color as any, x, y);
      ghosts.set(player.id, ghost);
    });

    const sortedPlayerIds = [...players].sort((a, b) => a.id.localeCompare(b.id));
    const seed = simpleHash(gameSessionId);
    const initialBombHolderIndex = seed % sortedPlayerIds.length;
    const initialBombHolderId = sortedPlayerIds[initialBombHolderIndex].id;
    
    const bombHolder = ghosts.get(initialBombHolderId);
    if (bombHolder) {
      bombHolder.hasBomb = true;
    }

    const gameStartTime = Date.now();
    gameStateRef.current = {
      ghosts,
      bombHolderId: initialBombHolderId,
      bombTimer: 30000,
      eliminatedPlayers: [],
      gameStartTime,
      bombPassCooldown: 0,
      lastBombPassTime: gameStartTime,
      gameCompleted: false
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());

      if (e.key === ' ' || e.key.toLowerCase() === 'shift') {
        const currentGhost = ghosts.get(currentPlayerId);
        if (currentGhost) {
          currentGhost.activateDash();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = (timestamp: number) => {
      if (!gameStateRef.current) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const state = gameStateRef.current;
      const currentGhost = state.ghosts.get(currentPlayerId);

      if (currentGhost && !state.eliminatedPlayers.includes(currentPlayerId)) {
        let dx = 0;
        let dy = 0;

        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= 1;
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += 1;
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= 1;
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += 1;

        currentGhost.move(dx, dy, { width: canvas.width, height: canvas.height });
        currentGhost.updateCooldown(deltaTime);

        setDashReady(currentGhost.dashCooldown === 0);
      }

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;

        if (ghost.id !== currentPlayerId) {
          ghost.updateCooldown(deltaTime);
        }
      });

      if (state.bombPassCooldown > 0) {
        state.bombPassCooldown = Math.max(0, state.bombPassCooldown - deltaTime);
      }

      if (state.bombHolderId && state.bombPassCooldown === 0) {
        const bombHolder = state.ghosts.get(state.bombHolderId);
        if (bombHolder && !state.eliminatedPlayers.includes(state.bombHolderId)) {
          let closestGhost: Ghost | null = null;
          let closestDistance = Infinity;

          for (const otherGhost of state.ghosts.values()) {
            if (
              otherGhost.id !== bombHolder.id &&
              !state.eliminatedPlayers.includes(otherGhost.id)
            ) {
              const distance = bombHolder.distanceTo(otherGhost);
              if (distance < 40 && distance < closestDistance) {
                closestDistance = distance;
                closestGhost = otherGhost;
              }
            }
          }

          if (closestGhost) {
            bombHolder.hasBomb = false;
            closestGhost.hasBomb = true;
            state.bombHolderId = closestGhost.id;
            state.lastBombPassTime = Date.now();
            state.bombPassCooldown = 500;

            // Atualizar estado no servidor via WebSocket
            gameSocket.updateGameState({
              bomb_holder_id: closestGhost.id,
              bomb_timer: 30000,
              last_bomb_pass_time: Date.now()
            });
          }
        }
      }

      const timeSinceLastPass = Date.now() - state.lastBombPassTime;
      const remainingTime = Math.max(0, 30000 - timeSinceLastPass);
      state.bombTimer = remainingTime;
      setBombTimer(Math.max(0, Math.ceil(remainingTime / 1000)));

      if (state.bombTimer <= 0 && state.bombHolderId) {
        state.eliminatedPlayers.push(state.bombHolderId);
        setEliminatedCount(state.eliminatedPlayers.length);

        const bombHolder = state.ghosts.get(state.bombHolderId);
        if (bombHolder) {
          bombHolder.hasBomb = false;
        }

        // Atualizar estado no servidor via WebSocket
        gameSocket.updateGameState({
          eliminated_players: state.eliminatedPlayers,
          bomb_holder_id: null
        });

        const remainingPlayers = Array.from(state.ghosts.values()).filter(
          (g) => !state.eliminatedPlayers.includes(g.id)
        );

        if (remainingPlayers.length === 1 && !state.gameCompleted) {
          state.gameCompleted = true;
          const results: Array<{ player_id: string; player_name: string; rank: number; points: number }> = [];
          const totalPlayers = players.length;

          const winner = remainingPlayers[0];
          if (!winner) return;
          
          results.push({
            player_id: winner.id,
            player_name: winner.name,
            rank: 1,
            points: totalPlayers
          });

          const eliminatedInOrder = [...state.eliminatedPlayers].reverse();
          eliminatedInOrder.forEach((playerId, index) => {
            const ghost = state.ghosts.get(playerId);
            if (ghost) {
              const rank = index + 2;
              results.push({
                player_id: ghost.id,
                player_name: ghost.name,
                rank,
                points: totalPlayers - rank + 1
              });
            }
          });

          const allPlayerIds = new Set(results.map(r => r.player_id));
          players.forEach((player) => {
            if (!allPlayerIds.has(player.id)) {
              const rank = totalPlayers;
              results.push({
                player_id: player.id,
                player_name: player.player_name,
                rank,
                points: 1
              });
            }
          });

          results.sort((a, b) => a.rank - b.rank);

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          
          // Notificar todos os jogadores que o jogo terminou
          gameSocket.updateGameState({
            eliminated_players: state.eliminatedPlayers,
            game_completed: true,
            results: results
          });
          
          onGameComplete(results);
          return;
        } else if (remainingPlayers.length > 0) {
          const sortedRemaining = [...remainingPlayers].sort((a, b) => a.id.localeCompare(b.id));
          const seed = simpleHash(gameSessionId + state.eliminatedPlayers.length.toString());
          const newBombHolderIndex = seed % sortedRemaining.length;
          const newBombHolder = sortedRemaining[newBombHolderIndex];
          newBombHolder.hasBomb = true;
          state.bombHolderId = newBombHolder.id;
          state.lastBombPassTime = Date.now();
          state.bombPassCooldown = 0;
        }
      }

      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;

        const color = getGhostColorHex(ghost.color);

        if (ghost.isDashing) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.fillStyle = color + '66';
          ctx.beginPath();
          ctx.arc(ghost.position.x, ghost.position.y, 35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ghost.position.x, ghost.position.y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ghost.position.x - 6, ghost.position.y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ghost.position.x + 6, ghost.position.y - 5, 4, 0, Math.PI * 2);
        ctx.fill();

        if (ghost.hasBomb) {
          ctx.save();
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(ghost.position.x, ghost.position.y + 25, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.fillRect(ghost.position.x - 1, ghost.position.y + 15, 2, 10);
          ctx.restore();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ghost.name, ghost.position.x, ghost.position.y - 30);
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      if (gameStateRef.current) {
        gameStateRef.current.ghosts.forEach((ghost: Ghost) => ghost.cleanup());
      }
    };
  }, [players.length, currentPlayerId, gameSessionId]);

  // Conectar WebSocket e sincronizar estado
  useEffect(() => {
    if (!gameStateRef.current) return;

    // Conectar ao WebSocket
    gameSocket.connect(gameSessionId, currentPlayerId);

    // Enviar estado do jogador atual periodicamente
    const syncInterval = setInterval(() => {
      if (!gameStateRef.current) return;

      const currentGhost = gameStateRef.current.ghosts.get(currentPlayerId);
      if (!currentGhost) return;

      gameSocket.updatePlayerState(
        currentPlayerId,
        {
          x: currentGhost.position.x,
          y: currentGhost.position.y
        },
        currentGhost.hasBomb
      );
    }, 50); // Sincronizar a cada 50ms para melhor responsividade

    // Listener para mudanças de estado de outros jogadores
    const handlePlayerStateChange = (data: { playerId: string; position: { x: number; y: number }; hasBomb: boolean }) => {
      if (!gameStateRef.current || data.playerId === currentPlayerId) return;

      const ghost = gameStateRef.current.ghosts.get(data.playerId);
      if (ghost) {
        ghost.position.x = data.position.x;
        ghost.position.y = data.position.y;
        ghost.hasBomb = data.hasBomb;
      }
    };

    // Listener para mudanças de estado do jogo
    const handleGameStateChange = (gameState: any) => {
      if (!gameStateRef.current) return;

      // Sincronizar bomb holder
      if (gameState.bomb_holder_id !== undefined) {
        gameStateRef.current.bombHolderId = gameState.bomb_holder_id;
        
        gameStateRef.current.ghosts.forEach((ghost) => {
          ghost.hasBomb = ghost.id === gameState.bomb_holder_id;
        });
      }

      // Sincronizar eliminated players
      if (gameState.eliminated_players) {
        const newEliminated = gameState.eliminated_players;
        gameStateRef.current.eliminatedPlayers = newEliminated;
        setEliminatedCount(newEliminated.length);

        // Verificar se o jogo terminou
        const remainingPlayers = Array.from(gameStateRef.current.ghosts.values()).filter(
          (g) => !newEliminated.includes(g.id)
        );

        if (remainingPlayers.length === 1 && !gameStateRef.current.gameCompleted && gameState.game_completed) {
          gameStateRef.current.gameCompleted = true;
          if (gameState.results) {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            onGameComplete(gameState.results);
          }
        }
      }

      // Sincronizar bomb timer
      if (gameState.bomb_timer !== undefined) {
        gameStateRef.current.bombTimer = gameState.bomb_timer;
        setBombTimer(Math.max(0, Math.ceil(gameState.bomb_timer / 1000)));
      }
    };

    const handlePlayerDisconnected = (data: { playerId: string; gameSessionId: string }) => {
      if (!gameStateRef.current || data.playerId === currentPlayerId) return;

      if (!gameStateRef.current.eliminatedPlayers.includes(data.playerId)) {
        gameStateRef.current.eliminatedPlayers.push(data.playerId);
        setEliminatedCount(gameStateRef.current.eliminatedPlayers.length);

        gameSocket.updateGameState({
          eliminated_players: gameStateRef.current.eliminatedPlayers
        });

        const remainingPlayers = Array.from(gameStateRef.current.ghosts.values()).filter(
          (g) => !gameStateRef.current!.eliminatedPlayers.includes(g.id)
        );

        if (remainingPlayers.length === 1 && !gameStateRef.current.gameCompleted) {
          gameStateRef.current.gameCompleted = true;
          const results: Array<{ player_id: string; player_name: string; rank: number; points: number }> = [];
          const totalPlayers = players.length;

          const winner = remainingPlayers[0];
          if (winner) {
            results.push({
              player_id: winner.id,
              player_name: winner.name,
              rank: 1,
              points: totalPlayers
            });

            const eliminatedInOrder = [...gameStateRef.current.eliminatedPlayers].reverse();
            eliminatedInOrder.forEach((playerId, index) => {
              const ghost = gameStateRef.current!.ghosts.get(playerId);
              if (ghost) {
                const rank = index + 2;
                results.push({
                  player_id: ghost.id,
                  player_name: ghost.name,
                  rank,
                  points: totalPlayers - rank + 1
                });
              }
            });

            const allPlayerIds = new Set(results.map(r => r.player_id));
            players.forEach((player) => {
              if (!allPlayerIds.has(player.id)) {
                const rank = totalPlayers;
                results.push({
                  player_id: player.id,
                  player_name: player.player_name,
                  rank,
                  points: 1
                });
              }
            });

            results.sort((a, b) => a.rank - b.rank);

            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            
            gameSocket.updateGameState({
              eliminated_players: gameStateRef.current.eliminatedPlayers,
              game_completed: true,
              results: results
            });
            
            onGameComplete(results);
          }
        }
      }
    };

    gameSocket.onPlayerStateChange(handlePlayerStateChange);
    gameSocket.onGameStateChange(handleGameStateChange);
    gameSocket.onPlayerDisconnected(handlePlayerDisconnected);

    return () => {
      clearInterval(syncInterval);
      gameSocket.offPlayerStateChange(handlePlayerStateChange);
      gameSocket.offGameStateChange(handleGameStateChange);
      gameSocket.offPlayerDisconnected(handlePlayerDisconnected);
      gameSocket.disconnect();
    };
  }, [currentPlayerId, gameSessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex flex-col items-center justify-center p-4">
      <div className="mb-4 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Pega-Pega Bomba!</h2>
        <p className="text-purple-200">Não deixe a bomba explodir com você!</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Bomb className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-purple-200 text-sm">Tempo da Bomba</p>
              <p className="text-white text-2xl font-bold">{bombTimer}s</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Zap className={`w-8 h-8 ${dashReady ? 'text-yellow-400' : 'text-gray-500'}`} />
            <div>
              <p className="text-purple-200 text-sm">Dash</p>
              <p className="text-white text-lg font-bold">{dashReady ? 'Pronto!' : 'Recarregando...'}</p>
            </div>
          </div>

          <div>
            <p className="text-purple-200 text-sm">Eliminados</p>
            <p className="text-white text-2xl font-bold">{eliminatedCount}/{players.length}</p>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="bg-indigo-950 rounded-2xl shadow-2xl border-4 border-white/20"
      />

      <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <p className="text-purple-200 text-sm text-center">
          <span className="font-bold">Controles:</span> WASD ou Setas para mover • Espaço ou Shift para Dash
        </p>
      </div>
    </div>
  );
}
