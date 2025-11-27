#!/bin/bash
cd "$(dirname "$0")"

echo "Adicionando coluna game_state à tabela game_sessions..."

cat <<EOF | docker compose exec -T backend-db psql -U root -d demolish
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS game_state jsonb DEFAULT '{}'::jsonb;
EOF

if [ $? -eq 0 ]; then
    echo "Coluna game_state adicionada com sucesso."
else
    echo "Erro ao adicionar coluna game_state."
    exit 1
fi



