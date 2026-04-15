# Fake News Generator (Full Stack)

Scrape real news via RSS, asynchronously transform it into satirical “fake news” with OpenAI, then browse and chat per-article.

## Quick Start (Docker)

1. Set your OpenAI key in the shell (do **not** commit it):

```bash
export OPENAI_API_KEY="..."
```

2. Start everything:

```bash
docker compose up -d --build
```

3. Open:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001 (e.g. `GET /api/health`)

To stop:

```bash
docker compose down
```

## Dev/Debug (Docker, with bind mounts)

This runs:

- backend: `pnpm --filter backend start:debug` (Node inspector exposed on `9229`)
- frontend: `pnpm --filter frontend dev`

```bash
export OPENAI_API_KEY="..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Then attach your debugger to `localhost:9229`.

## Dev/Debug (Run apps locally, keep DB/Redis in Docker)

Start only infra:

```bash
docker compose up -d postgres redis
```

Then run apps on your host OS:

```bash
pnpm install
make dev
```

## Environment Variables

See `.env.example` for a full list.

Required for Docker:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL` (default: `gpt-5.4-nano`)
- `OPENAI_BASE_URL` (for OpenAI-compatible providers)
- `SCRAPE_CRON` (cron expression to enable scheduled scraping)

## Core Endpoints (Backend)

- `POST /api/scrape` triggers RSS scraping and enqueues async transforms
- `GET /api/articles?source=NYT|NPR|Guardian&page=1&limit=20` lists transformed (DONE) articles
- `GET /api/articles/:id` article detail (includes original + fake)
- `GET /api/articles/:articleId/chat` chat history (persisted)
- `POST /api/articles/:articleId/chat` non-stream chat completion (persisted)
- `GET /api/articles/:articleId/chat/stream?message=...` SSE streaming chat (persisted)

## Architecture Notes

- Backend: NestJS with Clean/Hexagonal-style module structure (`domain/` ports, `application/` use-cases, `infrastructure/` adapters, `presentation/` controllers).
- Async pipeline: BullMQ queue + worker using a processor **file path** so transforms run in a separate Node process.
- Frontend: Next.js with Feature-Sliced structure (`features/*`, `shared/*`), React Query for server state, Zustand for UI filter state, `use-next-sse` for streaming chat.

## Tests

```bash
pnpm test
pnpm --filter backend test:e2e
pnpm --filter frontend test
```
