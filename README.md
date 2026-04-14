# Peak Homework — Stock Price Tracker

A NestJS application that tracks stock prices by periodically polling the [Finnhub API](https://finnhub.io/). The system is split into two independently runnable processes:

- **API server** — exposes a REST API for querying and managing tracked stock symbols.
- **Worker** — a background process that consumes a BullMQ queue, polls Finnhub for prices, and persists them to the database.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Data Model](#data-model)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
  - [With Docker (recommended)](#with-docker-recommended)
  - [Local Development](#local-development)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        API Server                        │
│                                                         │
│  StockController ──► StockService ──► FinnhubApiService │
│                           │                             │
│                       PrismaService                     │
└───────────────────────────┬─────────────────────────────┘
                            │  Redis (BullMQ)
                            │  queue: "stock-price"
┌───────────────────────────▼─────────────────────────────┐
│                          Worker                          │
│                                                         │
│  StockQueueProducer  ──► schedules repeating job        │
│  StockQueueProcessor ──► fetches prices from Finnhub    │
│                           │                             │
│                       PrismaService ──► PostgreSQL       │
└─────────────────────────────────────────────────────────┘
```

### How the server and worker are separated

The API server and the worker are **two separate NestJS application contexts** built from the same Docker image but started with different entry points:

| Process    | Entry point          | NestJS module  | Purpose                                            |
| ---------- | -------------------- | -------------- | -------------------------------------------------- |
| API server | `dist/src/main.js`   | `AppModule`    | HTTP REST API only — no queue consumers            |
| Worker     | `dist/src/worker.js` | `WorkerModule` | No HTTP server — only queue producer and processor |

The API server (`AppModule`) does **not** import BullMQ at all. It never touches the queue directly.

The worker (`WorkerModule`) does **not** expose any HTTP port. It only:

1. Sets up a BullMQ **job scheduler** that enqueues an `update-all-symbols` job every minute.
2. Processes `update-all-symbols` jobs by loading all active symbols from the database and enqueuing individual `update-symbol-price` jobs.
3. Processes `update-symbol-price` jobs by calling Finnhub and persisting the price.

This means you can scale the worker independently from the API server, and neither process crashes the other.

---

## Services

### Infrastructure services

| Service    | Image                | Port   | Purpose          |
| ---------- | -------------------- | ------ | ---------------- |
| `postgres` | `postgres:17-alpine` | `5432` | Primary database |
| `redis`    | `redis:7-alpine`     | `6379` | BullMQ job queue |

### Application services

| Service    | Entry command               | Port   | Purpose                                             |
| ---------- | --------------------------- | ------ | --------------------------------------------------- |
| `migrator` | `npx prisma migrate deploy` | —      | One-shot: runs DB migrations on startup, then exits |
| `app`      | `node dist/src/main.js`     | `3000` | REST API server                                     |
| `worker`   | `node dist/src/worker.js`   | —      | Background job processor                            |

---

## Data Model

```prisma
model StockSymbol {
  id            String       @id @default(cuid())
  symbol        String       @unique
  isActive      Boolean      @default(false)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  lastCheckedAt DateTime?
  prices        StockPrice[]
}

model StockPrice {
  id            String      @id @default(cuid())
  stockSymbolId String
  price         Decimal     @db.Decimal(12, 4)
  fetchedAt     DateTime    @default(now())
  stockSymbol   StockSymbol @relation(...)
}
```

A `StockSymbol` with `isActive = true` is picked up by the worker every minute and a price record is stored in `StockPrice`. The moving average is computed over the last **10** recorded prices.

---

## API Endpoints

The Swagger UI is available at **`http://localhost:3000/api`** when the server is running.

### `GET /stock/:symbol`

Returns the latest recorded price, the timestamp of that record, and the 10-period moving average.

**Example response:**

```json
{
  "symbol": "AAPL",
  "currentPrice": 175.34,
  "lastUpdatedAt": "2026-04-14T10:00:00.000Z",
  "movingAverage": 174.12
}
```

`currentPrice`, `lastUpdatedAt`, and `movingAverage` are `null` when no prices have been recorded yet for the symbol.

Returns **404** if the symbol does not exist in the database or if Finnhub returns a zero price for it.

---

### `PUT /stock/:symbol`

Upserts the symbol in the database and enables or disables periodic price tracking.

**Request body (optional):**

```json
{
  "isActive": true
}
```

`isActive` defaults to `true` if omitted. Set it to `false` to stop tracking a symbol without deleting it.

**Example response:**

```json
{
  "symbol": "AAPL",
  "isActive": true,
  "createdAt": "2026-04-14T09:00:00.000Z",
  "updatedAt": "2026-04-14T10:00:00.000Z"
}
```

Returns **404** if Finnhub does not recognise the symbol (price is zero).

---

## Environment Variables

Create a `.env` file in the project root (same directory as `docker-compose.yml`):

```env
# Application
NODE_ENV=production
PORT=3000

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=peak_homework

# Redis (used by the worker only)
REDIS_URL=redis://redis:6379

# Finnhub
FINNHUB_BASE_URL=https://finnhub.io/api/v1
FINNHUB_API_KEY=your_finnhub_api_key_here
```

A free Finnhub API key can be obtained at [https://finnhub.io](https://finnhub.io).

---

## Running the Application

### With Docker (recommended)

Requires: Docker and Docker Compose.

```bash
# Build images and start all services (postgres, redis, migrator, app, worker)
docker compose up --build

# Run in detached mode
docker compose up --build -d

# Stop all services
docker compose down

# Stop and remove volumes (wipes the database)
docker compose down -v
```

Docker Compose starts services in the correct order:

1. `postgres` and `redis` start first and wait until healthy.
2. `migrator` runs `prisma migrate deploy` and exits.
3. `app` (API server) and `worker` start in parallel once the migrator completes.

The API will be available at **`http://localhost:3000`**.

---

### Local Development

Requires: Node.js 24, a running PostgreSQL instance, and a running Redis instance.

```bash
# Install dependencies
npm install

# Generate the Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start the API server in watch mode
npm run start:dev

# In a separate terminal, start the worker (requires a production build first)
npm run build
npm run start:worker
```

To run the API server and worker together in development you need two terminal sessions because they are separate processes.

---

### Available npm Scripts

| Script                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run build`        | Compile TypeScript to `dist/`                  |
| `npm run start`        | Start the API server (requires build)          |
| `npm run start:dev`    | Start the API server in watch/hot-reload mode  |
| `npm run start:prod`   | Start the API server from `dist/` (production) |
| `npm run start:worker` | Start the worker from `dist/`                  |
| `npm run lint`         | Run ESLint and auto-fix issues                 |
| `npm run format`       | Run Prettier on `src/` and `test/`             |

---

## Running Tests

All unit tests live alongside the source files as `*.spec.ts` files. The test suite uses Jest with `ts-jest`.

```bash
# Run all unit tests
npm run test

# Run tests in watch mode (re-runs on file change)
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e

# Run tests with the Node.js debugger attached
npm run test:debug
```

### What is tested

| Spec file                             | What it covers                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `stock/stock.service.spec.ts`         | `getStock` and `upsertStock` — database queries, Finnhub responses, 404 handling |
| `stock/stock.controller.spec.ts`      | HTTP layer — correct status codes and DTO mapping                                |
| `stock/stock.queue.producer.spec.ts`  | Job scheduler registration and `addSymbolUpdateJob`                              |
| `stock/stock.queue.processor.spec.ts` | `update-all-symbols` and `update-symbol-price` job handling, zero-price guard    |
| `stock/finnhub-api.service.spec.ts`   | Finnhub HTTP client — successful response, network errors, non-OK status         |
| `app.controller.spec.ts`              | Root health-check controller                                                     |

Prisma is mocked via `src/__mocks__/prismaClient.ts` so no real database connection is needed for unit tests.

---

## Project Structure

```
src/
├── main.ts                  # API server entry point
├── worker.ts                # Worker entry point
├── app.module.ts            # Root module for the API server
├── worker.module.ts         # Root module for the worker
├── prisma/
│   ├── prisma.module.ts     # PrismaModule (global)
│   └── prisma.service.ts    # PrismaService wrapper
├── stock/
│   ├── stock.module.ts      # StockModule (imported by AppModule)
│   ├── stock.controller.ts  # GET /stock/:symbol, PUT /stock/:symbol
│   ├── stock.service.ts     # Business logic, moving average calculation
│   ├── finnhub-api.service.ts # HTTP client for Finnhub
│   ├── stock.queue.ts       # Queue name and job name constants
│   ├── stock.queue.producer.ts  # Schedules repeating jobs (used by WorkerModule)
│   ├── stock.queue.processor.ts # Processes jobs (used by WorkerModule)
│   └── dto/                 # Request/response DTOs with Swagger decorators
└── generated/
    └── prisma/              # Auto-generated Prisma client (do not edit)

prisma/
├── schema.prisma            # Database schema
└── migrations/              # Applied migration SQL files
```
