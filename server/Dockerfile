FROM node:20-alpine AS builder
WORKDIR /app

# Копируем манифесты монорепозитория
COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Устанавливаем зависимости с учетом воркспейсов
RUN npm ci

# Копируем конфиг TS и исходники бэкенда
COPY tsconfig*.json ./
COPY server ./server

WORKDIR /app/server
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Копируем манифесты
COPY package*.json ./
COPY server/package*.json ./server/

# Ставим только продакшн зависимости
RUN npm ci --only=production

# Копируем собранный код бэка и схему
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma

# Копируем сгенерированный Prisma Client (он лежит в КОРНЕВОМ node_modules)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

WORKDIR /app/server
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]