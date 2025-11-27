const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type Room = {
  id: string;
  room_code: string;
  host_name: string;
  min_players: number;
  max_games: number;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  player_name: string;
  ghost_color: string;
  total_score: number;
  joined_at: string;
};

export type GameSession = {
  id: string;
  room_id: string;
  game_type: string;
  game_number: number;
  status: 'pending' | 'active' | 'completed';
  results: Array<{ player_id: string; player_name: string; rank: number; points: number }>;
  started_at: string | null;
  completed_at: string | null;
};

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const error = await response.json().catch(() => ({ error: 'Not found' }));
      throw new Error(error.error || 'Not found');
    }
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  rooms: {
    create: (data: { host_name: string; min_players: number; max_games: number; room_code: string }): Promise<Room> =>
      request<Room>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getByCode: (roomCode: string): Promise<Room> =>
      request<Room>(`/api/rooms/${roomCode}`),

    update: (roomId: string, data: { status?: 'waiting' | 'playing' | 'finished' }): Promise<Room> =>
      request<Room>(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  players: {
    create: (data: { room_id: string; player_name: string; ghost_color: string }): Promise<Player> =>
      request<Player>('/api/players', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getById: (playerId: string): Promise<Player> =>
      request<Player>(`/api/players/${playerId}`),

    getByRoom: (roomId: string): Promise<Player[]> =>
      request<Player[]>(`/api/rooms/${roomId}/players`),

    update: (playerId: string, data: { total_score?: number }): Promise<Player> =>
      request<Player>(`/api/players/${playerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  gameSessions: {
    create: (data: { room_id: string; game_type: string; game_number: number }): Promise<GameSession> =>
      request<GameSession>('/api/game-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createBatch: (sessions: Array<{ room_id: string; game_type: string; game_number: number }>): Promise<GameSession[]> =>
      request<GameSession[]>('/api/game-sessions/batch', {
        method: 'POST',
        body: JSON.stringify({ sessions }),
      }),

    getById: (sessionId: string): Promise<GameSession> =>
      request<GameSession>(`/api/game-sessions/${sessionId}`),

    getByRoom: (roomId: string, status?: string): Promise<GameSession[]> =>
      request<GameSession[]>(`/api/rooms/${roomId}/game-sessions${status ? `?status=${status}` : ''}`),

    update: (sessionId: string, data: {
      status?: 'pending' | 'active' | 'completed';
      results?: Array<{ player_id: string; player_name: string; rank: number; points: number }>;
      started_at?: string;
      completed_at?: string;
    }): Promise<GameSession> =>
      request<GameSession>(`/api/game-sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
};

