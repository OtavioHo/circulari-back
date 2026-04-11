# Circulari

Inventory management app — catalog physical items with AI-assisted identification and price estimation.

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter + Bloc |
| Backend | Node.js + NestJS |
| Database | PostgreSQL + Prisma |
| Storage | S3-compatible (AWS S3 or Cloudflare R2) |
| AI | OpenAI API (GPT-4o) |
| Deploy | Docker + Nginx on VPS |

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start the database
docker compose up -d

# 4. Generate Prisma client
npm run prisma:generate

# 5. Start the API
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start API in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint and auto-fix `src/` |
| `npm run docs:dev` | Start VitePress docs site |
| `npm run prisma:migrate` | Create and apply a new migration |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |

## Documentation

Full architecture, API reference, and data models are in [`docs/`](./docs/) — run `npm run docs:dev` to browse them locally.
