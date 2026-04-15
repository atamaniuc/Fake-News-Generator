# Fake News Generator — Project Notes

This document is the “how it works” reference for the project. It’s intentionally more detailed than `README.md`, but aims to stay practical and implementation-oriented.

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
  - `GET /api/articles/:articleId/chat/stream?message=...&requestId=...` (SSE)
- Sources summary:
  - `GET /api/sources` returns per-source `DONE` counts and total `DONE`

## Async Pipeline (Scrape → Transform)

Diagrams:
- `docs/diagrams/async-pipeline.mmd`
- `docs/diagrams/chat-sse.mmd`

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

### Seeding sources (fresh DB)

The UI source filter is backed by `GET /api/sources`. On an empty database, the backend seeds the default sources (NYT/NPR/Guardian) on startup (idempotent upserts).

### ScrapeScheduler (enabled by default)

Scraping is driven by the same code path whether it’s triggered manually or by the scheduler:

- Manual trigger: `POST /api/scrape` → `ScrapeFeedsUseCase.execute()`
- Automatic trigger: `ScrapeScheduler` runs once immediately on backend startup, then on a cron schedule (also calls `ScrapeFeedsUseCase.execute()`).

By default the scheduler is **enabled**:

- If `SCRAPE_CRON` is unset or blank, the backend uses `*/5 * * * *` (every 5 minutes).
- `make install` also writes `SCRAPE_CRON=*/5 * * * *` into `.env` unless you override it.

#### Overlap behavior (scheduler vs manual)

The scheduler has a simple in-process overlap guard:

- If the previous scheduled scrape is still running, the next scheduled tick is skipped (to avoid piling up work).

Manual scrapes can still overlap with a running scheduled scrape because they’re separate HTTP requests. This is intentionally kept simple; correctness is preserved because:

- `Article.originalUrl` is unique, so upserting is idempotent across runs.
- Jobs are enqueued only when an article row is newly created.
- A near-duplicate heuristic can also suppress cross-source duplicates (see below).

### Why “separate process” matters

BullMQ is configured with a processor **file path** so the job runs in a forked Node process.
That processor cannot use Nest DI, so it creates its own Prisma + OpenAI clients using env vars.

### Scheduled scraping (default)

On backend startup, scraping runs once immediately, then continues on the cron schedule from `SCRAPE_CRON`.

- Default value: `*/5 * * * *` (every 5 minutes)
- `make install` writes this default into `.env` unless you override it.

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

### Idempotency for retries / fallback (`requestId`)

Streaming can drop (network, rate limits, browser behavior). To avoid duplicate persisted messages when a request is retried (or falls back to the non-stream endpoint), chat messages support an optional `requestId`:

- Frontend generates a UUID per send
- Backend upserts `USER` and `ASSISTANT` messages by `(articleId, requestId, role)`

## Bonus Features Implemented

- Scheduled scraping:
  - Set `SCRAPE_CRON` to enable the scheduler (cron expression).
- Similarity / near-duplicate detection:
  - A lightweight title token Jaccard heuristic skips near-duplicates across sources (recent window).
- Streaming chat responses:
  - SSE endpoint streams assistant deltas to the UI.

## Near-Duplicate Detection (Cross-Source)

To reduce “the same story from multiple feeds”, the scraper includes a lightweight heuristic in the article repository:

- Scope: only compares against **recent articles from other sources** (last ~48 hours).
- Candidate set: takes up to **200** recent titles (other sources) for comparison.
- Tokenization: lowercased, non-alphanumerics replaced with spaces; tokens shorter than 3 chars are dropped.
- Similarity: **Jaccard** similarity on token sets.
- Threshold: if similarity is `>= 0.75`, the new article is treated as a near-duplicate and is not created (so no transform job is enqueued).

This is intentionally not a “perfect” dedupe system. It’s fast, easy to reason about, and good enough for RSS feeds where the same story often has very similar headlines.

## Dev/Debug Workflows

### Run modes (recommended)

Use the Makefile as the single entrypoint:

```bash
make install env=prod
make install env=dev
make install env=local
```

`env=local` is the fastest inner-loop:
- runs only Postgres+Redis in Docker
- runs backend/frontend on your host via `pnpm`

### Debugging

- Backend inspector: `:9229` in dev docker mode (and when running `pnpm --filter backend start:debug`).
- Prisma Studio: `make studio` on `:5555`
