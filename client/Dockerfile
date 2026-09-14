FROM node:22-alpine AS builder
WORKDIR /app

# Копируем манифесты монорепозитория
COPY package*.json ./
COPY client/package*.json ./client/

# Устанавливаем зависимости
RUN npm ci

# Копируем корневой tsconfig (если он есть) и исходники клиента
COPY tsconfig*.json ./
COPY client ./client

# Собираем клиент
WORKDIR /app/client
RUN npm run build

# Раздача Nginx
FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]