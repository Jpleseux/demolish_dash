import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'demolish_dash',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

app.use(cors());
app.use(express.json());

// Rooms endpoints
app.post('/api/rooms', async (req, res) => {
  const client = await pool.connect();
  try {
    const { host_name, min_players, max_games, room_code } = req.body;

    if (!room_code || room_code.trim().length === 0) {
      return res.status(400).json({ error: 'Room code is required' });
    }

    const normalizedCode = room_code.trim().toUpperCase();

    const result = await client.query(
      `INSERT INTO rooms (room_code, host_name, min_players, max_games, status)
       VALUES ($1, $2, $3, $4, 'waiting')
       RETURNING *`,
      [normalizedCode, host_name, min_players, max_games]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating room:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Room code already exists' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/rooms/:roomCode', async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomCode } = req.params;

    if (!roomCode || roomCode.trim().length === 0) {
      return res.status(400).json({ error: 'Room code is required' });
    }

    const normalizedCode = roomCode.trim().toUpperCase();

    const result = await client.query(
      `SELECT * FROM rooms WHERE UPPER(TRIM(room_code)) = UPPER(TRIM($1))`,
      [normalizedCode]
    );

    if (result.rows.length === 0) {
      const allRooms = await client.query(`SELECT room_code FROM rooms LIMIT 10`);
      console.log(`Room not found: ${normalizedCode}. Available rooms:`, allRooms.rows.map(r => r.room_code));
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/rooms', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM rooms` );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/rooms/:roomId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    const result = await client.query(
      `UPDATE rooms SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Players endpoints
app.post('/api/players', async (req, res) => {
  const client = await pool.connect();
  try {
    const { room_id, player_name, ghost_color } = req.body;

    const result = await client.query(
      `INSERT INTO players (room_id, player_name, ghost_color, total_score)
       VALUES ($1, $2, $3, 0)
       RETURNING *`,
      [room_id, player_name, ghost_color]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/rooms/:roomId/players', async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomId } = req.params;

    const result = await client.query(
      `SELECT * FROM players WHERE room_id = $1 ORDER BY joined_at ASC`,
      [roomId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/players/:playerId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { playerId } = req.params;

    const result = await client.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/players/:playerId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { playerId } = req.params;
    const { total_score } = req.body;

    const result = await client.query(
      `UPDATE players SET total_score = $1 WHERE id = $2 RETURNING *`,
      [total_score, playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Game sessions endpoints
app.post('/api/game-sessions', async (req, res) => {
  const client = await pool.connect();
  try {
    const { room_id, game_type, game_number } = req.body;

    const result = await client.query(
      `INSERT INTO game_sessions (room_id, game_type, game_number, status, results)
       VALUES ($1, $2, $3, 'pending', '[]'::jsonb)
       RETURNING *`,
      [room_id, game_type, game_number]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating game session:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/game-sessions/batch', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessions } = req.body;

    const values = sessions.map((s, i) => {
      const base = i * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3}, 'pending', '[]'::jsonb)`;
    }).join(', ');

    const params = sessions.flatMap(s => [s.room_id, s.game_type, s.game_number]);

    const query = `
      INSERT INTO game_sessions (room_id, game_type, game_number, status, results)
      VALUES ${values}
      RETURNING *
    `;

    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error creating game sessions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/game-sessions/:sessionId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.params;

    const result = await client.query(
      `SELECT * FROM game_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching game session:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/rooms/:roomId/game-sessions', async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomId } = req.params;
    const { status } = req.query;

    let query = `SELECT * FROM game_sessions WHERE room_id = $1`;
    const params = [roomId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY game_number ASC`;

    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching game sessions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/game-sessions/:sessionId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.params;
    const { status, results, started_at, completed_at, game_state } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (results !== undefined) {
      updates.push(`results = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(results));
    }
    if (started_at !== undefined) {
      updates.push(`started_at = $${paramIndex++}`);
      params.push(started_at);
    }
    if (completed_at !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      params.push(completed_at);
    }
    if (game_state !== undefined) {
      updates.push(`game_state = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(game_state));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(sessionId);
    const query = `UPDATE game_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating game session:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/game-sessions/:sessionId/player-state', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.params;
    const { player_id, position, has_bomb } = req.body;

    const sessionResult = await client.query(
      `SELECT game_state FROM game_sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    let gameState = sessionResult.rows[0].game_state || {};
    if (!gameState.players) {
      gameState.players = {};
    }

    gameState.players[player_id] = {
      position,
      has_bomb,
      updated_at: new Date().toISOString()
    };

    await client.query(
      `UPDATE game_sessions SET game_state = $1::jsonb WHERE id = $2`,
      [JSON.stringify(gameState), sessionId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating player state:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/game-sessions/:sessionId/state', async (req, res) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.params;

    const result = await client.query(
      `SELECT game_state FROM game_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    res.json(result.rows[0].game_state || {});
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// WebSocket para sincronização do jogo
// Mapa para rastrear playerId por socket
const socketToPlayer = new Map();
const playerToSocket = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-game', (data) => {
    const gameSessionId = typeof data === 'string' ? data : data.gameSessionId;
    const playerId = typeof data === 'object' ? data.playerId : null;
    
    socket.join(`game-${gameSessionId}`);
    console.log(`Client ${socket.id} joined game ${gameSessionId}`);
    
    if (playerId) {
      socketToPlayer.set(socket.id, { gameSessionId, playerId });
      playerToSocket.set(playerId, socket.id);
    }
  });

  socket.on('player-state-update', async (data) => {
    const { gameSessionId, playerId, position, hasBomb } = data;
    
    // Atualizar estado no banco
    try {
      const client = await pool.connect();
      const sessionResult = await client.query(
        `SELECT game_state FROM game_sessions WHERE id = $1`,
        [gameSessionId]
      );

      if (sessionResult.rows.length > 0) {
        let gameState = sessionResult.rows[0].game_state || {};
        if (!gameState.players) {
          gameState.players = {};
        }

        gameState.players[playerId] = {
          position,
          has_bomb: hasBomb,
          updated_at: new Date().toISOString()
        };

        await client.query(
          `UPDATE game_sessions SET game_state = $1::jsonb WHERE id = $2`,
          [JSON.stringify(gameState), gameSessionId]
        );
      }
      client.release();
    } catch (error) {
      console.error('Error updating player state:', error);
    }

    // Broadcast para outros jogadores na mesma sala
    socket.to(`game-${gameSessionId}`).emit('player-state-changed', {
      playerId,
      position,
      hasBomb
    });
  });

  socket.on('game-state-update', async (data) => {
    const { gameSessionId, gameState } = data;
    
    // Atualizar estado no banco
    try {
      const client = await pool.connect();
      await client.query(
        `UPDATE game_sessions SET game_state = $1::jsonb WHERE id = $2`,
        [JSON.stringify(gameState), gameSessionId]
      );
      client.release();
    } catch (error) {
      console.error('Error updating game state:', error);
    }

    // Broadcast para outros jogadores
    io.to(`game-${gameSessionId}`).emit('game-state-changed', gameState);
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      const { gameSessionId, playerId } = playerInfo;
      
      // Notificar outros jogadores que este jogador desconectou
      io.to(`game-${gameSessionId}`).emit('player-disconnected', {
        playerId,
        gameSessionId
      });
      
      // Atualizar estado do jogo para marcar jogador como desconectado
      try {
        const client = await pool.connect();
        const sessionResult = await client.query(
          `SELECT game_state FROM game_sessions WHERE id = $1`,
          [gameSessionId]
        );

        if (sessionResult.rows.length > 0) {
          let gameState = sessionResult.rows[0].game_state || {};
          if (!gameState.disconnected_players) {
            gameState.disconnected_players = [];
          }
          if (!gameState.disconnected_players.includes(playerId)) {
            gameState.disconnected_players.push(playerId);
          }

          await client.query(
            `UPDATE game_sessions SET game_state = $1::jsonb WHERE id = $2`,
            [JSON.stringify(gameState), gameSessionId]
          );
        }
        client.release();
      } catch (error) {
        console.error('Error updating disconnected player:', error);
      }
      
      socketToPlayer.delete(socket.id);
      playerToSocket.delete(playerId);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

