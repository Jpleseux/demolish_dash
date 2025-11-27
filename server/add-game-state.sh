#!/bin/bash
cd "$(dirname "$0")"

if ! docker compose ps | grep -q "demolish-db.*Up"; then
    echo "Container do banco de dados não está rodando. Iniciando containers..."
    docker compose up -d backend-db
    sleep 5
fi

echo "Adicionando coluna game_state à tabela game_sessions..."
cat database/add-game-state.sql | docker compose exec -T backend-db psql -U root -d demolish

if [ $? -eq 0 ]; then
    echo "Coluna game_state adicionada com sucesso."
else
    echo "Erro ao adicionar coluna game_state."
    exit 1
fi



