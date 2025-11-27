import { useEffect, useRef, useState } from 'react';
import { Player } from '../../lib/api';
import { Ghost, getGhostColorHex } from '../../core/Ghost';
import { gameSocket } from '../../core/GameSocket';

interface BoulderRunGameProps {
  players: Player[];
  currentPlayerId: string;
  gameSessionId: string;
  onGameComplete: (results: Array<{ player_id: string; player_name: string; rank: number; points: number }>) => void;
}

interface Boulder {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface GameState {
  ghosts: Map<string, Ghost>;
  eliminatedPlayers: string[];
  boulders: Boulder[];
  gameCompleted: boolean;
}

export default function BoulderRunGame({ players, currentPlayerId, gameSessionId, onGameComplete }: BoulderRunGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysPressed = useRef<Set<string>>(new Set());
  const lastSpawnRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const gameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    const ghosts = new Map<string, Ghost>();
    const startY = canvas.height - 80;
    const spacing = canvas.width / (players.length + 1);

    players.forEach((p, i) => {
      const x = spacing * (i + 1);
      const y = startY;
      const ghost = new Ghost(p.id, p.player_name, p.ghost_color as any, x, y);
      ghost.velocity.x = 0;
      ghost.velocity.y = 0;
      ghosts.set(p.id, ghost);
    });

    gameStateRef.current = {
      ghosts,
      eliminatedPlayers: [],
      boulders: [],
      gameCompleted: false
    };

    const onKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const spawnBoulder = () => {
      const radius = Math.random() * 25 + 20;
      gameStateRef.current?.boulders.push({
        x: Math.random() * (canvas.width - radius * 2) + radius,
        y: -radius,
        radius,
        speed: Math.random() * 1.5 + 1
      });
    };

    const loop = (t: number) => {
      if (!gameStateRef.current) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = t;
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = t - lastTimeRef.current;
      lastTimeRef.current = t;

      if (t - lastSpawnRef.current > 800) {
        spawnBoulder();
        lastSpawnRef.current = t;
      }

      const state = gameStateRef.current;
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      const currentGhost = state.ghosts.get(currentPlayerId);
      if (currentGhost && !state.eliminatedPlayers.includes(currentPlayerId)) {
        let dx = 0;
        let dy = 0;
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) dx -= 1;
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) dx += 1;
        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) dy -= 1;
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) dy += 1;

        currentGhost.move(dx, dy, { width: canvasW, height: canvasH });
      }

      state.ghosts.forEach((g) => {
        if (g.id !== currentPlayerId && !state.eliminatedPlayers.includes(g.id)) {
          g.position.x += g.velocity.x;
          g.position.y += g.velocity.y;
        }
        g.velocity.x *= 0.9;
        g.velocity.y *= 0.9;
      });

      state.boulders.forEach((b) => {
        b.y += b.speed * dt * 0.05;
      });

      state.boulders = state.boulders.filter((b) => b.y - b.radius < canvasH);

      state.ghosts.forEach((ghost) => {
        if (state.eliminatedPlayers.includes(ghost.id)) return;

        for (const b of state.boulders) {
          const dx = ghost.position.x - b.x;
          const dy = ghost.position.y - b.y;
          if (dx * dx + dy * dy <= (b.radius + 20) * (b.radius + 20)) {
            state.eliminatedPlayers.push(ghost.id);
            setEliminatedCount(state.eliminatedPlayers.length);

            gameSocket.updateGameState({
              eliminated_players: state.eliminatedPlayers
            });
          }
        }
      });

      const alive = [...state.ghosts.values()].filter(
        (g) => !state.eliminatedPlayers.includes(g.id)
      );

      if (alive.length === 1 && !state.gameCompleted) {
        state.gameCompleted = true;

        const total = players.length;
        const results: any[] = [];

        const winner = alive[0];
        results.push({
          player_id: winner.id,
          player_name: winner.name,
          rank: 1,
          points: total
        });

        const eliminated = [...state.eliminatedPlayers].reverse();
        eliminated.forEach((id, i) => {
          const ghost = state.ghosts.get(id);
          if (ghost)
            results.push({
              player_id: ghost.id,
              player_name: ghost.name,
              rank: i + 2,
              points: total - (i + 1)
            });
        });

        const known = new Set(results.map((r) => r.player_id));
        players.forEach((p) => {
          if (!known.has(p.id))
            results.push({
              player_id: p.id,
              player_name: p.player_name,
              rank: total,
              points: 1
            });
        });

        results.sort((a, b) => a.rank - b.rank);

        gameSocket.updateGameState({
          eliminated_players: state.eliminatedPlayers,
          game_completed: true,
          results
        });

        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        onGameComplete(results);
        return;
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvasW, canvasH);

      state.boulders.forEach((b) => {
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
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

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gameStateRef.current?.ghosts.forEach((g) => g.cleanup());
    };
  }, []);

  useEffect(() => {
    gameSocket.connect(gameSessionId, currentPlayerId);

    const interval = setInterval(() => {
      if (!gameStateRef.current) return;
      const ghost = gameStateRef.current.ghosts.get(currentPlayerId);
      if (!ghost) return;
      gameSocket.updatePlayerState(currentPlayerId, {
        x: ghost.position.x,
        y: ghost.position.y,
      }, false);
    }, 50);

    const onPlayerChange = (data: any) => {
      if (!gameStateRef.current || data.playerId === currentPlayerId) return;
      const g = gameStateRef.current.ghosts.get(data.playerId);
      if (g) {
        g.position.x = data.position.x;
        g.position.y = data.position.y;
      }
    };

    const onGameChange = (data: any) => {
      if (!gameStateRef.current) return;
      if (data.eliminated_players) {
        gameStateRef.current.eliminatedPlayers = data.eliminated_players;
        setEliminatedCount(data.eliminated_players.length);
      }
    };

    gameSocket.onPlayerStateChange(onPlayerChange);
    gameSocket.onGameStateChange(onGameChange);

    return () => {
      clearInterval(interval);
      gameSocket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 flex flex-col items-center justify-center p-4">
      <div className="mb-4 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Fugir das pedras!</h2>
        <p className="text-purple-200">O ultimo vivo vence</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-4">
        <div className="flex items-center gap-6">

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
