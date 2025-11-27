import { api, GameSession } from '../lib/api';

export interface GameResult {
  player_id: string;
  player_name: string;
  rank: number;
  points: number;
}
// 'tag_bomb', 'platform_push', 'boulder_run'
export class GameManager {
  static readonly AVAILABLE_GAMES = ['falling_tiles', 'tag_bomb', 'platform_push', 'boulder_run'];

  static calculatePoints(rank: number, totalPlayers: number): number {
    return totalPlayers - rank + 1;
  }

  static async createGameSessions(roomId: string, maxGames: number): Promise<boolean> {
    try {
      const gameSessions = [];

      for (let i = 1; i <= maxGames; i++) {
        const randomGame = this.AVAILABLE_GAMES[Math.floor(Math.random() * this.AVAILABLE_GAMES.length)];

        gameSessions.push({
          room_id: roomId,
          game_type: randomGame,
          game_number: i,
        });
      }

      await api.gameSessions.createBatch(gameSessions);
      return true;
    } catch (error) {
      console.error('Error in createGameSessions:', error);
      return false;
    }
  }

  static async getNextGame(roomId: string): Promise<GameSession | null> {
    try {
      const games = await api.gameSessions.getByRoom(roomId, 'pending');
      if (games && games.length > 0) {
        return games[0]; // Already sorted by game_number
      }
      return null;
    } catch (error) {
      console.error('Error fetching next game:', error);
      return null;
    }
  }

  static async getCurrentGame(roomId: string): Promise<GameSession | null> {
    try {
      const games = await api.gameSessions.getByRoom(roomId, 'active');
      if (games && games.length > 0) {
        return games[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching current game:', error);
      return null;
    }
  }

  static async startGame(gameId: string): Promise<boolean> {
    try {
      await api.gameSessions.update(gameId, {
        status: 'active',
        started_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error starting game:', error);
      return false;
    }
  }

  static async completeGame(gameId: string, results: GameResult[]): Promise<boolean> {
    try {
      // Update game session
      await api.gameSessions.update(gameId, {
        status: 'completed',
        results: results,
        completed_at: new Date().toISOString(),
      });

      // Update player scores
      for (const result of results) {
        try {
          const player = await api.players.getById(result.player_id);
          await api.players.update(result.player_id, {
            total_score: player.total_score + result.points,
          });
        } catch (error) {
          console.error('Error updating player score:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error in completeGame:', error);
      return false;
    }
  }

  static async getAllGames(roomId: string): Promise<GameSession[]> {
    try {
      const games = await api.gameSessions.getByRoom(roomId);
      return games || [];
    } catch (error) {
      console.error('Error fetching games:', error);
      return [];
    }
  }

  static subscribeToGames(roomId: string, callback: () => void) {
    // Polling implementation to replace Supabase real-time
    const intervalId = setInterval(() => {
      callback();
    }, 2000); // Poll every 2 seconds

    // Return an object with unsubscribe method
    return {
      unsubscribe: () => {
        clearInterval(intervalId);
      }
    };
  }
}
