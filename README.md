# Сервис управления заявками ЖКХ (Диспетчерская и Мини-апп МАХ)

Полнофункциональная платформа для обработки аварийных и регулярных заявок жильцов управляющих компаний. Включает в себя веб-панель для диспетчеров и мастеров, мобильный веб-интерфейс для жителей (интегрируемый в мессенджер МАХ) и внутреннее S3-совместимое объектное хранилище Garage для медиафайлов.

---

## 🛠 Стек технологий

* **Frontend:** React 19, Vite, TanStack Query (React Query), Tailwind CSS, Lucide / Heroicons.
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
┌────▼─────────┐   ┌──────▼───────┐
│ client (:80) │   │ server (:5000│
│  (React/SPA) │   │ (Express/API)│
└──────────────┘   └──────┬───────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
     ┌──────▼──────┐             ┌──────▼──────┐
     │  db (:5432) │             │storage(:3900│
     │(PostgreSQL) │             │(Garage S3)  │
     └─────────────┘             └─────────────┘

```

---

## 📋 Предварительные требования

Перед развертыванием убедитесь, что на целевом сервере/машине установлены:

* **Docker Engine** (версия 24.0+)
* **Docker Compose** (V2 plugin)
* Утилита `openssl` (для генерации секретных ключей)

---

## ⚙️ Конфигурация окружения

Для запуска требуются два конфигурационных файла: корневой `.env` (для Docker Compose) и внутренний `server/.env` (для Node.js/Prisma).

### 1. Корневой файл `.env`

Создайте файл `.env` в корневой директории проекта:

```bash
# Порты сервисов на хосте
CLIENT_PORT=3000
SERVER_PORT=5000

# Параметры базы данных PostgreSQL
POSTGRES_USER=app_user
POSTGRES_PASSWORD=generate_strong_password_here
POSTGRES_DB=housing_services

# Параметры S3 хранилища Garage
GARAGE_ACCESS_KEY=GK1234567890abcdef12345678
GARAGE_SECRET_KEY=9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba
S3_BUCKET_NAME=tickets
# Сгенерируйте случайный 32-байтный hex-ключ командой: openssl rand -hex 32
GARAGE_RPC_SECRET=fae8b196894c25147814b7e80c52bb89a244410a76a521ef314e365020df111a

```

### 2. Файл `server/.env`

Создайте файл `.env` внутри директории `server/`:

```bash
PORT=5000
NODE_ENV=production

# Подключение к PostgreSQL внутри Docker-сети
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public"

# Подключение к хранилищу Garage S3 внутри Docker-сети
S3_ENDPOINT="http://storage:3900"
S3_REGION="garage"
S3_BUCKET="tickets"
S3_FORCE_PATH_STYLE="true"

# Секрет для выпуска JWT-токенов сотрудников
JWT_SECRET=super_secret_jwt_key_change_me

```

### 3. Конфигурация Garage (`deployment/garage.toml`)

Убедитесь, что в директории `deployment/` создан базовый файл конфигурации `garage.toml`:

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
s3_region = "garage"
root_domain = ".s3.garage"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage"

```

---

## 🚀 Сборка и запуск

1. **Клонируйте репозиторий:**
```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd <ИМЯ_ПАПКИ_ПРОЕКТА>

```


2. **Соберите и запустите сервисы в фоновом режиме:**
```bash
docker compose up -d --build

```


3. **Проверьте статус готовности сервисов:**
```bash
docker compose ps

```


*Все контейнеры должны перейти в состояние `healthy`.*
4. **Примените миграции базы данных:**
```bash
docker compose exec server npx prisma migrate deploy

```


5. *(Опционально)* Наполните базу тестовыми данными:
```bash
docker compose exec server npx prisma db seed

```



---

## 🌐 Доступные интерфейсы и порты

| Сервис | Адрес на хосте | Описание |
| --- | --- | --- |
| **Клиент (SPA)** | `[http://127.0.0.1:3000](http://127.0.0.1:3000)` | Рабочее место диспетчера / мастера |
| **Мини-апп жителя** | `[http://127.0.0.1:3000/?mode=resident](http://127.0.0.1:3000/?mode=resident)` | Экран подачи обращений жителями |
| **API Сервер** | `[http://127.0.0.1:5000](http://127.0.0.1:5000)` | REST API бэкенда |
| **Healthcheck API** | `[http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)` | Мониторинг работоспособности сервера |
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
# Или конкретного сервиса:
docker compose logs -f server
docker compose logs -f storage

```


* **Перезапуск конкретного сервиса:**
```bash
docker compose restart server

```


* **Остановка всего комплекса:**
```bash
docker compose down

```


* **Остановка с полным удалением данных (БД и файлы хранилища):**
```bash
docker compose down -v

```


* **Подключение к консоли PostgreSQL:**
```bash
docker compose exec db psql -U app_user -d housing_services

```


* **Проверка состояния ноды Garage S3:**
```bash
docker compose exec storage /garage status
docker compose exec storage /garage bucket list

```