import { api, Room as RoomType, Player } from '../lib/api';

export class RoomManager {
  static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static async createRoom(hostName: string, minPlayers: number, maxGames: number): Promise<{ room: RoomType; player: Player } | null> {
    try {
      const roomCode = this.generateRoomCode();

      const room = await api.rooms.create({
        room_code: roomCode,
        host_name: hostName,
        min_players: minPlayers,
        max_games: maxGames,
      });

      if (!room) {
        console.error('Error creating room');
        return null;
      }

      const availableColors = ['blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'cyan', 'white', 'gray'];
      const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

      const player = await api.players.create({
        room_id: room.id,
        player_name: hostName,
        ghost_color: randomColor,
      });

      if (!player) {
        console.error('Error creating player');
        return null;
      }

      return { room, player };
    } catch (error) {
      console.error('Error in createRoom:', error);
      return null;
    }
  }

  static async joinRoom(roomCode: string, playerName: string): Promise<{ room: RoomType; player: Player } | null> {
    try {
      const roomCodeUpper = roomCode.trim().toUpperCase();
      
      if (!roomCodeUpper || roomCodeUpper.length !== 6) {
        return null;
      }
      
      const room = await api.rooms.getByCode(roomCodeUpper);

      if (!room) {
        return null;
      }

      if (room.status !== 'waiting') {
        return null;
      }

      const existingPlayers = await api.players.getByRoom(room.id);

      if (!existingPlayers) {
        console.error('Error fetching existing players');
        return null;
      }

      const usedColors = new Set(existingPlayers.map(p => p.ghost_color));
      const availableColors = ['blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'cyan', 'white', 'gray']
        .filter(color => !usedColors.has(color));

      if (availableColors.length === 0) {
        console.error('No available colors');
        return null;
      }

      if (existingPlayers.length >= 10) {
        console.error('Room is full');
        return null;
      }

      const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

      const player = await api.players.create({
        room_id: room.id,
        player_name: playerName,
        ghost_color: randomColor,
      });

      if (!player) {
        console.error('Error creating player');
        return null;
      }

      return { room, player };
    } catch (error) {
      console.error('Error in joinRoom:', error);
      return null;
    }
  }

  static async getPlayers(roomId: string): Promise<Player[]> {
    try {
      const players = await api.players.getByRoom(roomId);
      return players || [];
    } catch (error) {
      console.error('Error fetching players:', error);
      return [];
    }
  }

  static async getRoomByCode(roomCode: string): Promise<RoomType | null> {
    if (!roomCode || roomCode.trim().length === 0) {
      return null;
    }
    
    try {
      const roomCodeUpper = roomCode.trim().toUpperCase();
      const room = await api.rooms.getByCode(roomCodeUpper);
      return room || null;
    } catch (error) {
      return null;
    }
  }

  static async updateRoomStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<boolean> {
    try {
      await api.rooms.update(roomId, { status });
      return true;
    } catch (error) {
      console.error('Error updating room status:', error);
      return false;
    }
  }

  static subscribeToRoom(roomId: string, callback: () => void) {
    // Polling implementation to replace Supabase real-time
    const intervalId = setInterval(() => {
      callback();
    }, 1000); // Poll every 1 second

    // Return an object with unsubscribe method
    return {
      unsubscribe: () => {
        clearInterval(intervalId);
      }
    };
  }
}
