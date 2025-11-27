# Etapa de build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

COPY index.js .env ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]