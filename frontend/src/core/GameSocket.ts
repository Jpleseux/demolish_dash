import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://demolishapi.lseux.dev.br';

class GameSocketManager {
  private socket: Socket | null = null;
  private gameSessionId: string | null = null;

  connect(gameSessionId: string, playerId?: string) {
    if (this.socket?.connected && this.gameSessionId === gameSessionId) {
      return this.socket;
    }

    this.disconnect();

    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    this.gameSessionId = gameSessionId;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.socket?.emit('join-game', { gameSessionId, playerId });
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.gameSessionId = null;
    }
  }

  onPlayerStateChange(callback: (data: { playerId: string; position: { x: number; y: number }; hasBomb: boolean }) => void) {
    if (this.socket) {
      this.socket.on('player-state-changed', callback);
    }
  }

  onGameStateChange(callback: (gameState: any) => void) {
    if (this.socket) {
      this.socket.on('game-state-changed', callback);
    }
  }

  offPlayerStateChange(callback?: any) {
    if (this.socket) {
      this.socket.off('player-state-changed', callback);
    }
  }

  offGameStateChange(callback?: any) {
    if (this.socket) {
      this.socket.off('game-state-changed', callback);
    }
  }

  updatePlayerState(playerId: string, position: { x: number; y: number }, hasBomb: boolean) {
    if (this.socket && this.gameSessionId) {
      this.socket.emit('player-state-update', {
        gameSessionId: this.gameSessionId,
        playerId,
        position,
        hasBomb
      });
    }
  }

  updateGameState(gameState: any) {
    if (this.socket && this.gameSessionId) {
      this.socket.emit('game-state-update', {
        gameSessionId: this.gameSessionId,
        gameState
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  onPlayerDisconnected(callback: (data: { playerId: string; gameSessionId: string }) => void) {
    if (this.socket) {
      this.socket.on('player-disconnected', callback);
    }
  }

  offPlayerDisconnected(callback?: any) {
    if (this.socket) {
      this.socket.off('player-disconnected', callback);
    }
  }
}

export const gameSocket = new GameSocketManager();

