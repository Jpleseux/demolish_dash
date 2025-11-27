#!/bin/bash

cd "$(dirname "$0")"

if ! sudo docker compose ps | grep -q "demolish-db.*Up"; then
    echo "Container do banco de dados não está rodando. Iniciando containers..."
    sudo docker compose up -d backend-db
    sleep 5
fi

echo "Executando schema.sql no banco de dados..."
cat database/schema.sql | sudo docker compose exec -T backend-db psql -U root -d demolish

if [ $? -eq 0 ]; then
    echo "Schema executado com sucesso!"
else
    echo "Erro ao executar o schema."
    exit 1
fi




