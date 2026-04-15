# Fake News Generator
[![CI](https://github.com/atamaniuc/Fake-News-Generator/actions/workflows/ci.yml/badge.svg)](https://github.com/atamaniuc/Fake-News-Generator/actions/workflows/ci.yml)

Scrape RSS feeds, asynchronously transform articles into satirical “fake news” via an OpenAI-compatible API, then browse and chat per-article.

## Setup / Run

Everything is driven by `make install` which will prompt for required env vars and write `.env`:

```bash
make install env=prod   # full stack in Docker (prod images)
make install env=dev    # full stack in Docker (dev images, backend debug on :9229)
make install env=local  # postgres+redis in Docker, apps run on host via pnpm
```

URLs:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001 (`GET /api/health`)
- Prisma Studio: http://localhost:5555 (`make studio`)

Environment variables (see `.env.example`):
- Required: `OPENAI_API_KEY`
- Optional: `OPENAI_MODEL`, `OPENAI_BASE_URL`
- Defaulted by `make install`: `SCRAPE_CRON=*/5 * * * *`

## Core Endpoints (Backend)

- `GET /api/health`
- `POST /api/scrape` (enqueue async transforms)
- `GET /api/articles?source=<name>&page=1&limit=20` (lists `DONE` articles)
- `GET /api/articles/:id`
- `GET /api/sources` (per-source counts + total)
- Chat:
  - `GET /api/articles/:articleId/chat`
  - `POST /api/articles/:articleId/chat`
  - `GET /api/articles/:articleId/chat/stream?message=...&requestId=...` (SSE)

## Architecture Notes

- Backend: NestJS organized as Clean/Hexagonal feature modules (`domain` ports, `application` use-cases, `infrastructure` adapters, `presentation` controllers).
- Async transform: BullMQ worker runs processor by file path (separate Node process; no Nest DI in the processor).
- Frontend: Next.js (Feature-Sliced), React Query for server state, SSE for streaming chat.

## Implemented

Backend:
- RSS scraping (NYT/NPR/Guardian) + persistence (Postgres/Prisma)
- Async transforms via BullMQ worker (separate process) + status tracking
- Chat per article (history + non-stream + SSE stream), persisted to DB
- Source counts API (`/api/sources`) and scheduled scraping enabled by default

Frontend:
- Fake news feed with source filter + total counts
- Article detail with “Original” toggle (HTML stripped for readability)
- Per-article chat UI with streaming and fallback

Bonus (all implemented):
- Scheduled scraping (`SCRAPE_CRON`, default every 5 minutes, plus immediate startup run)
- Near-duplicate detection across sources (Jaccard title tokens heuristic)
- Streaming chat responses (SSE)

## Tests

```bash
pnpm --filter backend lint
pnpm --filter backend test -- --run
pnpm --filter frontend test -- --run
pnpm build
```
