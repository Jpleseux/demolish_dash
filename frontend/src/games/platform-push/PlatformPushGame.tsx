import { useEffect, useRef, useState } from 'react';
import { Player } from '../../lib/api';
import { Ghost, getGhostColorHex } from '../../core/Ghost';
import { gameSocket } from '../../core/GameSocket';
import { Hand } from 'lucide-react';

interface PlatformPushGameProps {
  players: Player[];
  currentPlayerId: string;
  gameSessionId: string;
  onGameComplete: (results: Array<{ player_id: string; player_name: string; rank: number; points: number }>) => void;
}

interface GameState {
  ghosts: Map<string, Ghost>;
  eliminatedPlayers: string[];
  gameStartTime: number;
  pushCooldown: number;
  gameCompleted: boolean;
  platformBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface PushState {
  isPushing: boolean;
  pushDirection: { x: number; y: number } | null;
  pushStartTime: number;
}

const PUSH_DURATION = 300;
const PUSH_COOLDOWN_TIME = 2000;
const PUSH_FORCE = 0.5;
const PLATFORM_MARGIN = 100;

export default function PlatformPushGame({ players, currentPlayerId, gameSessionId, onGameComplete }: PlatformPushGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const pushStatesRef = useRef<Map<string, PushState>>(new Map());
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const [pushReady, setPushReady] = useState(true);

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

    const platformBounds = {
      x: PLATFORM_MARGIN,
      y: PLATFORM_MARGIN,
      width: canvas.width - PLATFORM_MARGIN * 2,
      height: canvas.height - PLATFORM_MARGIN * 2
    };

    const ghosts = new Map<string, Ghost>();
    const centerX = platformBounds.x + platformBounds.width / 2;
    const centerY = platformBounds.y + platformBounds.height / 2;
    const radius = Math.min(platformBounds.width, platformBounds.height) / 3;
    const angleStep = (Math.PI * 2) / players.length;

    players.forEach((player, index) => {
      const angle = angleStep * index;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const ghost = new Ghost(player.id, player.player_name, player.ghost_color as any, x, y);
      ghost.dashCooldown = 0;
      ghosts.set(player.id, ghost);
    });

    const gameStartTime = Date.now();
    gameStateRef.current = {
      ghosts,
      eliminatedPlayers: [],
      gameStartTime,
      pushCooldown: 0,
      gameCompleted: false,
      platformBounds
    };

    players.forEach((player) => {
      pushStatesRef.current.set(player.id, {
        isPushing: false,
        pushDirection: null,
        pushStartTime: 0
      });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());

      if (e.key === ' ' || e.key.toLowerCase() === 'shift') {
        const currentGhost = gameStateRef.current?.ghosts.get(currentPlayerId);
        if (currentGhost && gameStateRef.current) {
          const pushState = pushStatesRef.current.get(currentPlayerId);
          if (pushState && pushState.isPushing === false && gameStateRef.current.pushCooldown === 0) {
            let dx = 0;
            let dy = 0;

            if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= 1;
            if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += 1;
            if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= 1;
            if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += 1;

            if (dx !== 0 || dy !== 0) {
              const magnitude = Math.sqrt(dx * dx + dy * dy);
              pushState.isPushing = true;
              pushState.pushDirection = { x: dx / magnitude, y: dy / magnitude };
              pushState.pushStartTime = Date.now();
              gameStateRef.current.pushCooldown = PUSH_COOLDOWN_TIME;
              setPushReady(false);
            }
          }
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

        if (dx !== 0 || dy !== 0) {
          currentGhost.move(dx, dy, { width: canvas.width, height: canvas.height });
        } else {
          currentGhost.position.x += currentGhost.velocity.x;
          currentGhost.position.y += currentGhost.velocity.y;
          currentGhost.position.x = Math.max(0, Math.min(canvas.width, currentGhost.position.x));
          currentGhost.position.y = Math.max(0, Math.min(canvas.height, currentGhost.position.y));
        }
        currentGhost.updateCooldown(deltaTime);
      }

      if (state.pushCooldown > 0) {
        state.pushCooldown = Math.max(0, state.pushCooldown - deltaTime);
        if (state.pushCooldown === 0) {
          setPushReady(true);
        }
      }

      const currentPushState = pushStatesRef.current.get(currentPlayerId);
      if (currentPushState && currentPushState.isPushing) {
        const pushElapsed = Date.now() - currentPushState.pushStartTime;
        if (pushElapsed >= PUSH_DURATION) {
          currentPushState.isPushing = false;
          currentPushState.pushDirection = null;
        } else if (currentPushState.pushDirection) {
          const currentGhost = state.ghosts.get(currentPlayerId);
          if (currentGhost) {
            let closestGhost: Ghost | null = null;
            let closestDistance = Infinity;

            for (const otherGhost of state.ghosts.values()) {
              if (
                otherGhost.id !== currentGhost.id &&
                !state.eliminatedPlayers.includes(otherGhost.id)
              ) {
                const distance = currentGhost.distanceTo(otherGhost);
                if (distance < 50 && distance < closestDistance) {
                  closestDistance = distance;
                  closestGhost = otherGhost;
                }
              }
            }

            if (closestGhost && currentPushState.pushDirection) {
              const pushForce = PUSH_FORCE * (1 - pushElapsed / PUSH_DURATION);
              closestGhost.velocity.x += currentPushState.pushDirection.x * pushForce * 10;
              closestGhost.velocity.y += currentPushState.pushDirection.y * pushForce * 10;

              gameSocket.updateGameState({
                push_event: {
                  pusher_id: currentPlayerId,
                  pushed_id: closestGhost.id,
                  direction: currentPushState.pushDirection,
                  force: pushForce
                }
              });
            }
          }
        }
      }

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;

        if (ghost.id !== currentPlayerId) {
          ghost.position.x += ghost.velocity.x;
          ghost.position.y += ghost.velocity.y;
        }

        ghost.velocity.x *= 0.9;
        ghost.velocity.y *= 0.9;

        const bounds = state.platformBounds;
        const isOutOfBounds = 
          ghost.position.x < bounds.x ||
          ghost.position.x > bounds.x + bounds.width ||
          ghost.position.y < bounds.y ||
          ghost.position.y > bounds.y + bounds.height;

        if (isOutOfBounds && !state.eliminatedPlayers.includes(ghost.id)) {
          state.eliminatedPlayers.push(ghost.id);
          setEliminatedCount(state.eliminatedPlayers.length);

          gameSocket.updateGameState({
            eliminated_players: state.eliminatedPlayers
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
          }
        }

        ghost.position.x = Math.max(0, Math.min(canvas.width, ghost.position.x));
        ghost.position.y = Math.max(0, Math.min(canvas.height, ghost.position.y));
      });

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(
        state.platformBounds.x,
        state.platformBounds.y,
        state.platformBounds.width,
        state.platformBounds.height
      );

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(
        state.platformBounds.x,
        state.platformBounds.y,
        state.platformBounds.width,
        state.platformBounds.height
      );

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;

        const color = getGhostColorHex(ghost.color);
        const pushState = pushStatesRef.current.get(ghost.id);

        if (pushState && pushState.isPushing) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.fillStyle = color + '99';
          ctx.beginPath();
          ctx.arc(ghost.position.x, ghost.position.y, 30, 0, Math.PI * 2);
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

  useEffect(() => {
    if (!gameStateRef.current) return;

    gameSocket.connect(gameSessionId, currentPlayerId);

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
        false
      );
    }, 50);

    const handlePlayerStateChange = (data: { playerId: string; position: { x: number; y: number }; hasBomb: boolean }) => {
      if (!gameStateRef.current || data.playerId === currentPlayerId) return;

      const ghost = gameStateRef.current.ghosts.get(data.playerId);
      if (ghost) {
        ghost.position.x = data.position.x;
        ghost.position.y = data.position.y;
      }
    };

    const handleGameStateChange = (gameState: any) => {
      if (!gameStateRef.current) return;

      if (gameState.eliminated_players) {
        const newEliminated = gameState.eliminated_players;
        gameStateRef.current.eliminatedPlayers = newEliminated;
        setEliminatedCount(newEliminated.length);

        // Verificar se o jogo terminou via WebSocket
        if (gameState.game_completed && gameState.results && !gameStateRef.current.gameCompleted) {
          gameStateRef.current.gameCompleted = true;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          onGameComplete(gameState.results);
          return;
        }

        // Verificar se o jogo terminou localmente
        const remainingPlayers = Array.from(gameStateRef.current.ghosts.values()).filter(
          (g) => !newEliminated.includes(g.id)
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

            const eliminatedInOrder = [...newEliminated].reverse();
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
            
            // Notificar todos os jogadores que o jogo terminou
            gameSocket.updateGameState({
              eliminated_players: newEliminated,
              game_completed: true,
              results: results
            });
            
            onGameComplete(results);
          }
        }
      }

      if (gameState.push_event) {
        const { pusher_id, pushed_id, direction, force } = gameState.push_event;
        const pushedGhost = gameStateRef.current.ghosts.get(pushed_id);
        if (pushedGhost && direction && !gameStateRef.current.eliminatedPlayers.includes(pushed_id)) {
          pushedGhost.velocity.x += direction.x * force * 10;
          pushedGhost.velocity.y += direction.y * force * 10;
        }
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
        <h2 className="text-4xl font-bold text-white mb-2">Empurra na Plataforma!</h2>
        <p className="text-purple-200">Fique na plataforma! Quem cair é eliminado!</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Hand className={`w-8 h-8 ${pushReady ? 'text-yellow-400' : 'text-gray-500'}`} />
            <div>
              <p className="text-purple-200 text-sm">Empurrar</p>
              <p className="text-white text-lg font-bold">{pushReady ? 'Pronto!' : 'Recarregando...'}</p>
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
        className="bg-slate-900 rounded-2xl shadow-2xl border-4 border-white/20"
      />

      <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <p className="text-purple-200 text-sm text-center">
          <span className="font-bold">Controles:</span> WASD ou Setas para mover • Espaço ou Shift + Direção para Empurrar
        </p>
      </div>
    </div>
  );
}

