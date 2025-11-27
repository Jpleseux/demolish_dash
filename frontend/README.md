# Demolish Dash

Jogo de festa multiplayer com PostgreSQL self-hosted.

## Estrutura do Projeto

- `src/` - Frontend React + TypeScript
- `server/` - Backend API Express + PostgreSQL
- `database/` - Schema SQL do banco de dados

## Configuração

### 1. Banco de Dados PostgreSQL

Crie o banco de dados e execute o schema:

```bash
# Conecte ao PostgreSQL
psql -U postgres

# Crie o banco
CREATE DATABASE demolish_dash;

# Execute o schema
\i database/schema.sql
```

Ou execute diretamente:
```bash
psql -U postgres -d demolish_dash -f database/schema.sql
```

### 2. Backend API

```bash
cd server
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do PostgreSQL

# Inicie o servidor
npm start
# ou para desenvolvimento com auto-reload
npm run dev
```

Variáveis de ambiente do servidor (`.env`):
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=demolish_dash
DB_USER=postgres
DB_PASSWORD=sua_senha
PORT=3001
```

### 3. Frontend

```bash
# Na raiz do projeto
npm install

# Configure a URL da API (opcional, padrão é http://localhost:3001)
# Crie um arquivo .env na raiz:
echo "VITE_API_URL=http://localhost:3001" > .env

# Inicie o servidor de desenvolvimento
npm run dev
```

## Como Funciona

- O frontend se comunica com o backend via API REST
- O backend gerencia todas as operações do banco de dados PostgreSQL
- As atualizações em tempo real são feitas via polling (a cada 2 segundos)
- Não há mais dependência do Supabase

## Endpoints da API

### Rooms
- `POST /api/rooms` - Criar sala
- `GET /api/rooms/:roomCode` - Buscar sala por código
- `PATCH /api/rooms/:roomId` - Atualizar status da sala

### Players
- `POST /api/players` - Criar jogador
- `GET /api/players/:playerId` - Buscar jogador por ID
- `GET /api/rooms/:roomId/players` - Listar jogadores da sala
- `PATCH /api/players/:playerId` - Atualizar jogador

### Game Sessions
- `POST /api/game-sessions` - Criar sessão de jogo
- `POST /api/game-sessions/batch` - Criar múltiplas sessões
- `GET /api/game-sessions/:sessionId` - Buscar sessão por ID
- `GET /api/rooms/:roomId/game-sessions` - Listar sessões da sala
- `PATCH /api/game-sessions/:sessionId` - Atualizar sessão

## Desenvolvimento

Para desenvolvimento, você pode rodar ambos os servidores simultaneamente:

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
npm run dev
```

