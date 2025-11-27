-- Adicionar coluna game_state à tabela game_sessions
-- Execute este script no banco de dados para adicionar a coluna necessária

ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS game_state jsonb DEFAULT '{}'::jsonb;
