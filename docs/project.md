# Fake News Generator — Project Notes

## Technical Requirements (From assignment.md)

- Backend scrapes articles from 3 RSS feeds (NYT, NPR, The Guardian) and persists the raw article fields.
- Fake transformation must be asynchronous (scrape API should not block on the LLM).
- Frontend shows a fake-news feed, article detail with original toggle, filtering by source.
- Per-article chat:
  - Persisted chat history per article.
  - Backend handles prompts and responses.
- Relational database schema + migrations.
- Docker Compose spins up the full stack.

## Stack

- Backend: NestJS (TypeScript), Clean/Hexagonal-ish feature modules
- Async jobs: BullMQ (Redis)
- DB: Postgres (Prisma + migrations)
- Frontend: Next.js App Router (TypeScript), Feature-Sliced structure
- Streaming: SSE (frontend uses `use-next-sse`, backend uses Nest `@Sse`)
- Testing: Vitest (backend + frontend)
- Backend build: Nest SWC builder

## Domain Model (Prisma)

- `Source` — RSS feed identity (name + feedUrl)
- `Article` — original article fields + processing status
- `FakeArticle` — fake title/content linked 1:1 to `Article`
- `ChatMessage` — persisted per-article messages (USER/ASSISTANT)

## API Surface

- `POST /api/scrape`
  - Fetches all RSS feeds.
  - Inserts new articles into DB (dedupe by `originalUrl`).
  - Enqueues transform job for each newly created article.
  - Returns `202` quickly.
- `GET /api/articles?source=NYT|NPR|Guardian&page=1&limit=20`
  - Returns only `DONE` articles (persisted fake exists).
- `GET /api/articles/:id`
  - Full detail including `fake` and original fields.
- Chat:
  - `GET /api/articles/:articleId/chat`
  - `POST /api/articles/:articleId/chat`
  - `GET /api/articles/:articleId/chat/stream?message=...` (SSE)

## Async Pipeline (Scrape → Transform)

### High-level flow

```text
              POST /api/scrape
                    |
                    v
        +------------------------+
        | ScrapeFeedsUseCase     |
        |  - fetch RSS feeds     |
        |  - upsert articles     |
        |  - enqueue transforms  |
        +------------------------+
                    |
                    v
            +---------------+
            | BullMQ Queue  |
            |  "transform"  |
            +---------------+
                    |
                    v
     +----------------------------------+
     | BullMQ Worker (separate process) |
     |  transform.processor.ts          |
     |   - fetch Article from DB        |
     |   - call OpenAI                  |
     |   - create FakeArticle           |
     |   - update Article status        |
     +----------------------------------+
                    |
                    v
             +--------------+
             | Postgres DB  |
             +--------------+
```

### Why “separate process” matters

BullMQ is configured with a processor **file path** so the job runs in a forked Node process.
That processor cannot use Nest DI, so it creates its own Prisma + OpenAI clients using env vars.

## Chat (Persisted + Streaming)

```text
Browser
  |
  | GET /chat/stream?message=...
  v
Nest ChatController (@Sse)
  |
  | 1) Persist USER message
  | 2) Build prompt (original + fake context)
  | 3) Stream LLM deltas via SSE
  | 4) Persist ASSISTANT full message at the end
  v
Postgres (chat_messages)
```

## Bonus Features Implemented

- Scheduled scraping:
  - Set `SCRAPE_CRON` to enable the scheduler (cron expression).
- Similarity / near-duplicate detection:
  - A lightweight title token Jaccard heuristic skips near-duplicates across sources (recent window).
- Streaming chat responses:
  - SSE endpoint streams assistant deltas to the UI.

## Dev/Debug Workflows

- Docker dev/debug (bind mounts):
  - backend runs `start:debug` and exposes `9229`
  - frontend runs `next dev` on `3000`
- Prisma Studio:
  - runs as `prisma-studio` service on `5555`
- Host OS dev:
  - run only Postgres+Redis in Docker, run apps locally via pnpm.

