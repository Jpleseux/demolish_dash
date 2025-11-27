import { useEffect, useRef, useState } from 'react';
import { Player } from '../../lib/api';
import { Ghost, getGhostColorHex } from '../../core/Ghost';
import { gameSocket } from '../../core/GameSocket';
import { Hand } from 'lucide-react';

interface FallingTilesGameProps {
  players: Player[];
  currentPlayerId: string;
  gameSessionId: string;
  onGameComplete: (results: Array<{ player_id: string; player_name: string; rank: number; points: number }>) => void;
}

type TileStatus = 'safe' | 'warning' | 'fallen' | 'removed';

interface Tile {
  id: string;
  x: number;
  y: number;
  size: number;
  status: TileStatus;
  warnStart?: number;
}

interface GameStateLocal {
  ghosts: Map<string, Ghost>;
  eliminatedPlayers: string[];
  gameStartTime: number;
  gameCompleted: boolean;
  platformBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tiles: Tile[];
}

const GRID_COLS = 10;
const GRID_ROWS = 6;
const TILE_GAP = 4;
const TILE_WARN_TIME = 1000;
const TILE_SPAWN_INTERVAL = 1400;

export default function FallingTilesGame({ players, currentPlayerId, gameSessionId, onGameComplete }: FallingTilesGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameStateLocal | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);

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
      x: TILE_GAP,
      y: TILE_GAP + 60,
      width: canvas.width - TILE_GAP * 2,
      height: canvas.height - TILE_GAP * 2 - 60
    };

    const tileSizeW = Math.floor((platformBounds.width - TILE_GAP * (GRID_COLS + 1)) / GRID_COLS);
    const tileSizeH = Math.floor((platformBounds.height - TILE_GAP * (GRID_ROWS + 1)) / GRID_ROWS);
    const tileSize = Math.min(tileSizeW, tileSizeH);

    const tiles: Tile[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = platformBounds.x + TILE_GAP + c * (tileSize + TILE_GAP);
        const y = platformBounds.y + TILE_GAP + r * (tileSize + TILE_GAP);
        tiles.push({ id: `${r}-${c}`, x, y, size: tileSize, status: 'safe' });
      }
    }

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

    const startTime = Date.now();
    gameStateRef.current = {
      ghosts,
      eliminatedPlayers: [],
      gameStartTime: startTime,
      gameCompleted: false,
      platformBounds,
      tiles
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const moveLocalPlayer = (ghost: Ghost, dt: number) => {
      const speed = 0.28 * dt;
      let dx = 0;
      let dy = 0;
      if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= 1;
      if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += 1;
      if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= 1;
      if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += 1;
      if (dx !== 0 || dy !== 0) {
        ghost.move(dx, dy, { width: canvas.width, height: canvas.height });
      } else {
        ghost.position.x += ghost.velocity.x;
        ghost.position.y += ghost.velocity.y;
        ghost.position.x = Math.max(0, Math.min(canvas.width, ghost.position.x));
        ghost.position.y = Math.max(0, Math.min(canvas.height, ghost.position.y));
      }
      ghost.updateCooldown(dt);
    };

    const checkTileCollisions = () => {
      const state = gameStateRef.current;
      if (!state) return;
      state.tiles.forEach((tile) => {
        if (tile.status !== 'fallen') return;
        state.ghosts.forEach((ghost) => {
          if (state.eliminatedPlayers.includes(ghost.id)) return;
          if (ghost.position.x > tile.x && ghost.position.x < tile.x + tile.size && ghost.position.y > tile.y && ghost.position.y < tile.y + tile.size) {
            state.eliminatedPlayers.push(ghost.id);
            setEliminatedCount(state.eliminatedPlayers.length);
            gameSocket.updateGameState({
              eliminated_players: state.eliminatedPlayers
            });
          }
        });
      });
    };

    let lastSpawn = Date.now();
    const gameLoop = (timestamp: number) => {
      if (!gameStateRef.current) return;
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const state = gameStateRef.current;
      const currentGhost = state.ghosts.get(currentPlayerId);
      if (currentGhost && !state.eliminatedPlayers.includes(currentPlayerId)) {
        moveLocalPlayer(currentGhost, dt);
      }

      state.ghosts.forEach((g) => {
        if (g.id !== currentPlayerId) {
          g.position.x += g.velocity.x;
          g.position.y += g.velocity.y;
        }
        g.velocity.x *= 0.9;
        g.velocity.y *= 0.9;
        g.position.x = Math.max(state.platformBounds.x, Math.min(state.platformBounds.x + state.platformBounds.width, g.position.x));
        g.position.y = Math.max(state.platformBounds.y, Math.min(state.platformBounds.y + state.platformBounds.height, g.position.y));
      });

      if (Date.now() - lastSpawn > TILE_SPAWN_INTERVAL) {
        lastSpawn = Date.now();
        const hostId = players[0].id;
        if (currentPlayerId === hostId && !state.gameCompleted) {
          const safeTiles = state.tiles.filter(t => t.status === 'safe');
          if (safeTiles.length > 0) {
            const count = Math.min(4, Math.max(1, Math.floor(Math.random() * 4) + 1));
            const chosen: Tile[] = [];
            for (let i = 0; i < count && safeTiles.length > 0; i++) {
              const pick = safeTiles.splice(Math.floor(Math.random() * safeTiles.length), 1)[0];
              chosen.push(pick);
            }
            const warnings = chosen.map(t => ({ id: t.id, x: t.x, y: t.y }));
            gameSocket.updateGameState({ tiles_warning: warnings });
            chosen.forEach(t => {
              const local = state.tiles.find(tt => tt.id === t.id);
              if (local) {
                local.status = 'warning';
                local.warnStart = Date.now();
              }
            });
            setWarningCount(state.tiles.filter(t => t.status === 'warning').length);
            setTimeout(() => {
              const falls = chosen.map(t => ({ id: t.id, x: t.x, y: t.y }));
              gameSocket.updateGameState({ tiles_fall: falls });
              chosen.forEach(t => {
                const local = state.tiles.find(tt => tt.id === t.id);
                if (local) local.status = 'fallen';
              });
              setWarningCount(state.tiles.filter(t => t.status === 'warning').length);
              setTimeout(() => {
                chosen.forEach(t => {
                  const local = state.tiles.find(tt => tt.id === t.id);
                  if (local) local.status = 'removed';
                });
                gameSocket.updateGameState({ tiles_removed: chosen.map(t => ({ id: t.id })) });
              }, 600);
            }, TILE_WARN_TIME);
          }
        }
      }

      checkTileCollisions();

      if (state.eliminatedPlayers.length > 0) {
        const remaining = Array.from(state.ghosts.values()).filter(g => !state.eliminatedPlayers.includes(g.id));
        if (remaining.length === 1 && !state.gameCompleted) {
          state.gameCompleted = true;
          const results: Array<{ player_id: string; player_name: string; rank: number; points: number }> = [];
          const totalPlayers = players.length;
          const winner = remaining[0];
          results.push({ player_id: winner.id, player_name: winner.name, rank: 1, points: totalPlayers });
          const eliminatedInOrder = [...state.eliminatedPlayers].reverse();
          eliminatedInOrder.forEach((playerId, index) => {
            const ghost = state.ghosts.get(playerId);
            if (ghost) {
              const rank = index + 2;
              results.push({ player_id: ghost.id, player_name: ghost.name, rank, points: totalPlayers - rank + 1 });
            }
          });
          const allPlayerIds = new Set(results.map(r => r.player_id));
          players.forEach((p) => {
            if (!allPlayerIds.has(p.id)) {
              results.push({ player_id: p.id, player_name: p.player_name, rank: totalPlayers, points: 1 });
            }
          });
          results.sort((a, b) => a.rank - b.rank);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          gameSocket.updateGameState({ eliminated_players: state.eliminatedPlayers, game_completed: true, results });
          onGameComplete(results);
          return;
        }
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(state.platformBounds.x, state.platformBounds.y, state.platformBounds.width, state.platformBounds.height);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(state.platformBounds.x, state.platformBounds.y, state.platformBounds.width, state.platformBounds.height);

      state.tiles.forEach(tile => {
        if (tile.status === 'removed') return;
        if (tile.status === 'safe') ctx.fillStyle = '#334155';
        if (tile.status === 'warning') ctx.fillStyle = '#f59e0b';
        if (tile.status === 'fallen') ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.rect(tile.x, tile.y, tile.size, tile.size);
        ctx.fill();
      });

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;
        const color = getGhostColorHex(ghost.color);
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
      gameSocket.updatePlayerState(currentPlayerId, { x: currentGhost.position.x, y: currentGhost.position.y }, false);
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
      if (gameState.tiles_warning) {
        const warnings = gameState.tiles_warning as Array<{ id: string; x: number; y: number }>;
        warnings.forEach(w => {
          const tile = gameStateRef.current!.tiles.find(t => t.id === w.id);
          if (tile) {
            tile.status = 'warning';
            tile.warnStart = Date.now();
          }
        });
        setWarningCount(gameStateRef.current.tiles.filter(t => t.status === 'warning').length);
      }
      if (gameState.tiles_fall) {
        const falls = gameState.tiles_fall as Array<{ id: string; x: number; y: number }>;
        falls.forEach(f => {
          const tile = gameStateRef.current!.tiles.find(t => t.id === f.id);
          if (tile) tile.status = 'fallen';
        });
        setWarningCount(gameStateRef.current.tiles.filter(t => t.status === 'warning').length);
      }
      if (gameState.tiles_removed) {
        const rems = gameState.tiles_removed as Array<{ id: string }>;
        rems.forEach(r => {
          const tile = gameStateRef.current!.tiles.find(t => t.id === r.id);
          if (tile) tile.status = 'removed';
        });
      }
      if (gameState.eliminated_players) {
        const newEliminated = gameState.eliminated_players as string[];
        gameStateRef.current.eliminatedPlayers = newEliminated;
        setEliminatedCount(newEliminated.length);
        const remainingPlayers = Array.from(gameStateRef.current.ghosts.values()).filter(g => !newEliminated.includes(g.id));
        if (gameState.game_completed && gameState.results && !gameStateRef.current.gameCompleted) {
          gameStateRef.current.gameCompleted = true;
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          onGameComplete(gameState.results);
          return;
        }
        if (remainingPlayers.length === 1 && !gameStateRef.current.gameCompleted) {
          gameStateRef.current.gameCompleted = true;
          const results: Array<{ player_id: string; player_name: string; rank: number; points: number }> = [];
          const totalPlayers = players.length;
          const winner = remainingPlayers[0];
          if (winner) {
            results.push({ player_id: winner.id, player_name: winner.name, rank: 1, points: totalPlayers });
            const eliminatedInOrder = [...newEliminated].reverse();
            eliminatedInOrder.forEach((playerId, index) => {
              const ghost = gameStateRef.current!.ghosts.get(playerId);
              if (ghost) {
                const rank = index + 2;
                results.push({ player_id: ghost.id, player_name: ghost.name, rank, points: totalPlayers - rank + 1 });
              }
            });
            const allPlayerIds = new Set(results.map(r => r.player_id));
            players.forEach((player) => {
              if (!allPlayerIds.has(player.id)) {
                const rank = totalPlayers;
                results.push({ player_id: player.id, player_name: player.player_name, rank, points: 1 });
              }
            });
            results.sort((a, b) => a.rank - b.rank);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            gameSocket.updateGameState({ eliminated_players: newEliminated, game_completed: true, results });
            onGameComplete(results);
          }
        }
      }
    };

    const handlePlayerDisconnected = (data: { playerId: string; gameSessionId: string }) => {
      if (!gameStateRef.current || data.playerId === currentPlayerId) return;
      if (!gameStateRef.current.eliminatedPlayers.includes(data.playerId)) {
        gameStateRef.current.eliminatedPlayers.push(data.playerId);
        setEliminatedCount(gameStateRef.current.eliminatedPlayers.length);
        gameSocket.updateGameState({ eliminated_players: gameStateRef.current.eliminatedPlayers });
        const remainingPlayers = Array.from(gameStateRef.current.ghosts.values()).filter(g => !gameStateRef.current!.eliminatedPlayers.includes(g.id));
        if (remainingPlayers.length === 1 && !gameStateRef.current.gameCompleted) {
          gameStateRef.current.gameCompleted = true;
          const results: Array<{ player_id: string; player_name: string; rank: number; points: number }> = [];
          const totalPlayers = players.length;
          const winner = remainingPlayers[0];
          if (winner) {
            results.push({ player_id: winner.id, player_name: winner.name, rank: 1, points: totalPlayers });
            const eliminatedInOrder = [...gameStateRef.current.eliminatedPlayers].reverse();
            eliminatedInOrder.forEach((playerId, index) => {
              const ghost = gameStateRef.current!.ghosts.get(playerId);
              if (ghost) {
                const rank = index + 2;
                results.push({ player_id: ghost.id, player_name: ghost.name, rank, points: totalPlayers - rank + 1 });
              }
            });
            const allPlayerIds = new Set(results.map(r => r.player_id));
            players.forEach((player) => {
              if (!allPlayerIds.has(player.id)) {
                const rank = totalPlayers;
                results.push({ player_id: player.id, player_name: player.player_name, rank, points: 1 });
              }
            });
            results.sort((a, b) => a.rank - b.rank);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
        <h2 className="text-4xl font-bold text-white mb-2">Piso que Cai</h2>
        <p className="text-purple-200">Fuja dos blocos que vão cair. Último vivo vence.</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Hand className={`w-8 h-8 text-yellow-400`} />
            <div>
              <p className="text-purple-200 text-sm">Avisos</p>
              <p className="text-white text-lg font-bold">{warningCount} tiles</p>
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
          <span className="font-bold">Controles:</span> WASD ou Setas para mover
        </p>
      </div>
    </div>
  );
}
