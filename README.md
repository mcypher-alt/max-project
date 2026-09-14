# 🏢 Dispatch System (Умная Диспетчерская)

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

Fullstack-приложение для управления заявками, координации выездных мастеров и обслуживания жилого фонда. Проект находится в стадии активной разработки, с фокусом на строгую типизацию, безопасность и удобство использования на мобильных устройствах.

---

## ✨ Текущий функционал (Key Features)

*   **Ролевая модель (Role-Based UI):** Разделение интерфейса и доступов. Админ видит глобальную сводку и управляет распределением, мастер — только свои задачи.
*   **Mobile-First для мастеров:** Адаптивный, интуитивный интерфейс, спроектированный специально для работы "в полях" со смартфона.
*   **Безопасная авторизация:** Реализована через **HttpOnly cookies**, что защищает сессионные данные пользователя от XSS-атак.
*   **Управление заявками:** 
    *   Создание новых заявок.
    *   Выбор и привязка объекта (дома) из существующей базы данных.
    *   Назначение конкретного мастера на выполнение задачи.
*   **API-First подход:** Разделение логики на четкие REST API роуты через Express.

---

## 🛠 Стек технологий

### Frontend
*   **Core:** React, TypeScript
*   **Styling:** Tailwind CSS (utility-first подход для быстрого и гибкого UI)

### Backend & Database
*   **Server:** Node.js, Express
*   **ORM:** Prisma
*   **Database:** Postgre
*   **Security:** HttpOnly Cookies (JWT/Session management)

---

## 🚀 Дорожная карта (Roadmap)

Проект активно развивается. Запланировано внедрение следующего функционала (Work in Progress):

- [ ] **SMS Notifications:** Интеграция стороннего API для автоматической рассылки SMS-уведомлений мастерам и клиентам.
- [ ] **Landing Page Webhooks:** Реализация публичных API-эндпоинтов для автоматической регистрации заявок напрямую с внешнего сайта-лендинга.

---

## 💻 Локальный запуск (Local Development)

### Требования
*   Node.js 18+
*   npm или yarn

### Установка и запуск

1. **Клонируйте репозиторий:**
   ```bash
   git clone git@github.com:ВашЮзернейм/dispatcher-app.git
   cd dispatcher-app
   ```
2. **Настройка переменных окружения:**
*Создайте файл .env в корне проекта (или в папке server) на основе .env.example:*
  ```Ini, TOML
  DATABASE_URL="file:./dev.db"
  JWT_SECRET=super_secret_key
  CLIENT_URL=http://localhost:5173
  ```
3. **Установка зависимостей и настройка БД (Backend):**
   ```bash
   cd server
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```
4. **Запуск клиентской части (Frontend):**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```
## Скриншоты:
![Окно входа](https://github.com/user-attachments/assets/a3002f1a-7d62-4b6e-a8f4-38f797948257)
![Главный экран диспетчера](https://github.com/user-attachments/assets/4727a63e-9c0d-4ac7-921e-62ba95215b93)
![Главный экран мастера](https://github.com/user-attachments/assets/9a39bc83-b093-4d58-b9c2-47e1332aa5cf)
