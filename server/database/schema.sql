/*
  # Party Game Database Schema

  ## Overview
  Creates the database structure for a multiplayer party game system with temporary rooms,
  players, and game sessions tracking.

  ## New Tables
  
  ### `rooms`
  Stores temporary game room information
  - `id` (uuid, primary key) - Unique room identifier
  - `room_code` (text, unique) - 6-character code for joining
  - `host_name` (text) - Name of the room creator
  - `min_players` (integer) - Minimum players required (2-10)
  - `max_games` (integer) - Number of minigames to play
  - `status` (text) - Room status: waiting, playing, finished
  - `created_at` (timestamptz) - Room creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `players`
  Stores player information for each room
  - `id` (uuid, primary key) - Unique player identifier
  - `room_id` (uuid, foreign key) - Reference to room
  - `player_name` (text) - Player's chosen name
  - `ghost_color` (text) - Ghost character color
  - `total_score` (integer) - Cumulative score across all games
  - `joined_at` (timestamptz) - When player joined
  
  ### `game_sessions`
  Tracks individual minigame sessions and results
  - `id` (uuid, primary key) - Unique session identifier
  - `room_id` (uuid, foreign key) - Reference to room
  - `game_type` (text) - Type of minigame (e.g., 'tag_bomb')
  - `game_number` (integer) - Sequential game number in the party
  - `status` (text) - Game status: pending, active, completed
  - `results` (jsonb) - Game results with player rankings
  - `started_at` (timestamptz) - Game start time
  - `completed_at` (timestamptz) - Game completion time

  ## Notes
  - All data is temporary and can be cleaned up after room completion
  - No authentication required - casual party game experience
  - Room codes are short and memorable for easy joining
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code text UNIQUE NOT NULL,
  host_name text NOT NULL,
  min_players integer NOT NULL DEFAULT 2,
  max_games integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_min_players CHECK (min_players >= 2 AND min_players <= 10),
  CONSTRAINT valid_max_games CHECK (max_games >= 1 AND max_games <= 20),
  CONSTRAINT valid_status CHECK (status IN ('waiting', 'playing', 'finished'))
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  ghost_color text NOT NULL,
  total_score integer NOT NULL DEFAULT 0,
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  game_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  results jsonb DEFAULT '[]'::jsonb,
  game_state jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT valid_game_status CHECK (status IN ('pending', 'active', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);

