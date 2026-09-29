# Сервис управления заявками ЖКХ (Диспетчерская и Мини-апп МАХ)

Полнофункциональная платформа для обработки аварийных и регулярных заявок жильцов управляющих компаний. Включает в себя веб-панель для диспетчеров и мастеров, мобильный веб-интерфейс для жителей (интегрируемый в мессенджер МАХ) и внутреннее S3-совместимое объектное хранилище Garage для медиафайлов.

---

## 🛠 Стек технологий

* **Frontend:** React 19, Vite, TanStack Query (React Query), Tailwind CSS, Heroicons.
* **Backend:** Node.js, Express, Prisma ORM, AWS SDK v3 (`@aws-sdk/client-s3`).
* **База данных:** PostgreSQL 16 (Alpine).
* **Объектное хранилище:** Garage v2.3 (высокопроизводительное легковесное S3-хранилище на Rust).
* **Оркестрация:** Docker, Docker Compose, Nginx.

---

## 🏗 Архитектура контейнеров

```
[ Интернет / Пользователи ]
           │
     ┌─────┴──────────────┐
     │                    │
┌────▼──────────┐  ┌──────▼──────────┐
│ client (:80)  │  │ server (:5000)  │
│  (React/SPA)  │  │  (Express/API)  │
└───────────────┘  └──────┬──────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
     ┌──────▼──────┐             ┌──────▼──────┐
     │  db (:5432) │             │storage(:3900)
     │(PostgreSQL) │             │ (Garage S3) │
     └─────────────┘             └─────────────┘
```

---

## 📋 Предварительные требования

Перед развертыванием убедитесь, что на целевом сервере или локальной машине установлены:

* **Docker Engine** (версия 24.0+)
* **Docker Compose** (V2 plugin)
* Утилита **openssl** (для генерации секретных ключей)

---

## ⚙️ Конфигурация окружения

Все переменные окружения проекта централизованно хранятся в одном файле — **`server/.env`**.

---

### 1. Файл `server/.env`

Создайте файл `server/.env` со следующим содержимым:

```env
# Токен бота в мессенджере МАХ
MAX_BOT_TOKEN="f9LHodD0cOIH6FOiG5zmRXHDpyMl67_moITW72qjHAgz7t0Qd6BQtOoUjyblKKqXsQCO26AWx5KzyYc857t0"

# База данных PostgreSQL
DATABASE_URL=postgresql://dev:password@db:5432/main_db
POSTGRES_USER=dev
POSTGRES_PASSWORD=password
POSTGRES_DB=main_db

# Секрет для JWT-токенов сотрудников
JWT_SECRET=277ed2453219b7b05fa0a166974d8de5e03928214d8d483b27d5c115ef22f7eb

# Параметры Express-сервера и сети
NODE_ENV=production
PORT=5000
CLIENT_URL=https://uk-web.ru
TRUSTED_PROXIES=loopback,172.18.0.0/16

# Подключение к S3 (Garage S3)
S3_ENDPOINT=http://storage:3900
S3_ACCESS_KEY=GKb4ec413e87c0cd5b3d3ccc7c
S3_SECRET_KEY=f70a29de2a15a83d4fcbeaaae8c9e3569858f7ae4e88817633bf70428885fe3a
S3_BUCKET_NAME=uploads
S3_REGION=us-east-1
S3_PUBLIC_URL=https://uk-web.ru/api/files

# Ключи и настройки хранилища Garage S3
GARAGE_ACCESS_KEY=GKb4ec413e87c0cd5b3d3ccc7c
GARAGE_SECRET_KEY=f70a29de2a15a83d4fcbeaaae8c9e3569858f7ae4e88817633bf70428885fe3a
GARAGE_RPC_SECRET=e68cb62bf94d011f4c04738345a56624f4bbe6027a912ea25bbbb430a6e58383
```

---

### 2. Конфигурация Garage (`deployment/garage.toml`)

Файл монтируется в контейнер `storage` в режиме чтения. Убедитесь, что порт и регион совпадают с параметрами в `server/.env`:

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1

[rpc]
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"

[s3_api]
s3_bind_addr = "[::]:3900"
s3_region = "us-east-1"
root_domain = ".s3.garage"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage"
```

---

## 🚀 Пошаговое развертывание

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/mcypher-alt/max-project.git
   cd max-project
   ```

2. **Настройте переменные окружения:**
   Создайте файл `server/.env` по инструкции выше и свяжите его с корнем проекта символической ссылкой (для чтения параметров в `docker-compose.yml`):
   ```bash
   ln -s server/.env .env
   ```

3. **Соберите образы и запустите контейнеры:**
   ```bash
   docker compose up -d --build
   ```

4. **Проверьте состояние сервисов:**
   ```bash
   docker compose ps
   ```
   *Все ключевые сервисы (`db`, `storage`, `server`, `client`) должны перейти в состояние `healthy`.*

5. **Примените миграции базы данных Prisma:**
   ```bash
   docker compose exec server npx prisma migrate deploy
   ```

6. *(Опционально)* Наполните базу первичными справочниками и тестовыми данными:
   ```bash
   docker compose exec server npx prisma db seed
   ```

---

## 🌐 Доступные интерфейсы и порты

| Сервис | Адрес на хосте | Описание |
| :--- | :--- | :--- |
| **Клиент (SPA)** | `http://127.0.0.1:3000` | Рабочее место диспетчера и мастера |
| **Мини-апп жителя** | `http://127.0.0.1:3000/?mode=resident` | Экран подачи обращений жителями |
| **API Сервер** | `http://127.0.0.1:5000` | REST API бэкенда |
| **Healthcheck API** | `http://127.0.0.1:5000/health` | Эндпоинт проверки работоспособности сервера |
| **S3 API (Garage)** | `http://storage:3900` *(внутренний)* | Точка входа для загрузки фото |

---

## 📱 Логика работы экранов

* **Режим сотрудника:** доступен при переходе на корень `http://localhost:3000/`. Предоставляет авторизацию по пин-коду/токену, просмотр таблицы заявок, смену статусов, фильтрацию по управляющим компаниям, назначение мастеров и просмотр прикрепленных фото.
* **Режим жителя (МАХ WebApp):** активируется автоматически при открытии внутри Webview-мессенджера МАХ (через `window.WebApp.initDataUnsafe.user`) либо принудительно через query-параметр `?mode=resident`. Позволяет выбрать компанию, адрес дома, ввести номер квартиры, описать проблему и прикрепить до 5 фотографий повреждений.

---

## 🛠 Полезные команды для обслуживания

* **Просмотр логов в реальном времени:**
  ```bash
  docker compose logs -f
  # Или для конкретного сервиса:
  docker compose logs -f server
  docker compose logs -f storage
  ```

* **Перезапуск конкретного сервиса:**
  ```bash
  docker compose restart server
  ```

* **Остановка комплекса:**
  ```bash
  docker compose down
  ```

* **Остановка с удалением всех томов данных (БД и файлы хранилища):**
  ```bash
  docker compose down -v
  ```

* **Подключение к консоли PostgreSQL:**
  ```bash
  docker compose exec db psql -U dev -d main_db
  ```

* **Проверка состояния хранилища Garage S3:**
  ```bash
  docker compose exec storage /garage status
  docker compose exec storage /garage bucket list
  ```