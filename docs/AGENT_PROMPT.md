# Fake News Generator — AI Agent Prompt

> **Use this hint in Cursor/WebStorm AI/Codex as a system context.**
> Read in full before the topic how to write the first text code.

---

## 0. The role and rules of work

You are a Senior Full-Stack TypeScript Engineer. Your task is to implement **Fake News Generator** strictly according to this document.

**Rules:**
- Do not deviate from the described folder structure without explicit instructions.
- Do not add libraries that are not included in this document.
- Each file must be self-documented (JSDoc on public methods/classes).
- If something is ambiguous, choose a simpler solution.
- Write only working, compiled code.

---

## 1. Project Overview

Full-stack app:
1. **Scraper** — parses RSS feeds (NYT, NPR, Guardian), saves articles to the database.
2. **Transformer** — asynchronously generates satirical versions of articles via LLM (Groq/OpenAI-compatible API).
3. **News UI** — fake news feed with filtering, detailed viewing with original content.
4. **Chat** — per-article chat with a history persisted in the database.

---

## 2. Tech Stack (do not change unnecessarily)

### Monorepo
```
pnpm workspaces (NOT NX — excessive for the given scope)
```

### Backend
| What | Solution | Why |
|-----|---------|--------|
| Framework | **NestJS 11** | Robust features, enterprise-ready, clear interfaces |
| Language | **TypeScript 5.x** | Strict typing, maintainability |
| ORM + Migrations | **Prisma** | Type safety, DX, fast development |
| Database | **PostgreSQL 16** | Relational data requirements |
| Async Queue | **BullMQ + Redis** | Robust processing for the scraping → transformation pipeline |
| HTTP Client | **Axios** | RSS fetching |
| XML Parser | **xml2js** | RSS parsing |
| LLM Client | **openai** (official SDK) | Compatible with OpenAI, works with Groq via baseUrl |
| Validation | **class-validator + class-transformer** | NestJS-native |
| Config | **@nestjs/config** | Env validation via Joi |

### Frontend
| What | Solution | Why |
|-----|-----------------------------------|--------|
| Framework | **Next.js 15+** (App Router) | SSR, routing, DX |
| Language | **TypeScript 5.x** | Maintainability |
| Server State | **TanStack Query v5** | Caching, loading/error states, re-fetching |
| Global UI State | **Zustand** | Lightweight trigger for global filters/actions |
| UI Components | **shadcn/ui** | Accessible, ready-made components |
| Styling | **Tailwind CSS v4** | Modern utility-first CSS |
| HTTP Client | **Axios** (shared instance) | Consistency with backend |

### Infrastructure
| What | Solution |
|-----|---------|
| Containers | **docker-compose** (postgres + redis + backend + frontend) |
| Tasks | **Makefile** |
| Package Manager | **pnpm** |

---

## 3. Monorepo Structure

```
/
├── apps/
│   ├── backend/                    # NestJS
│   └── frontend/                   # Next.js
├── packages/
│   └── shared/                     # Shared types and DTOs
│       ├── src/
│       │   ├── types/
│       │   │   ├── article.types.ts
│       │   │   ├── chat.types.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml
├── Makefile
├── package.json                    # pnpm workspaces root
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

---

## 4. Backend — Architecture (Lightweight Hexagonal)

### 4.1 Principle

Each module is divided into 4 layers:

```
domain/          ← Pure entities and port interfaces (no dependencies on NestJS/Prisma)
application/     ← Use Cases (business logic), depends only on domain
infrastructure/  ← Port implementations (Prisma, OpenAI, Bull, Axios)
presentation/    ← Controllers, DTOs for HTTP
```

**Key Rule:** `domain` and `application` do not import anything from `infrastructure`.
Dependency direction is inward: `presentation → application → domain ← infrastructure`.

### 4.2 Backend Folder Structure

```
apps/backend/
├── src/
│   ├── modules/
│   │   │
│   │   ├── articles/                               # Articles module
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── article.entity.ts           # Pure domain model (plain class)
│   │   │   │   └── ports/
│   │   │   │       └── article.repository.port.ts  # interface IArticleRepository
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── get-articles.use-case.ts    # List + source filtering
│   │   │   │   │   └── get-article-by-id.use-case.ts
│   │   │   │   └── dtos/
│   │   │   │       └── article-filter.dto.ts
│   │   │   ├── infrastructure/
│   │   │   │   └── persistence/
│   │   │   │       └── prisma-article.repository.ts  # implements IArticleRepository
│   │   │   ├── presentation/
│   │   │   │   └── http/
│   │   │   │       ├── articles.controller.ts
│   │   │   │       └── article-response.dto.ts
│   │   │   └── articles.module.ts
│   │   │
│   │   ├── scraper/                                # RSS Scraper module
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── raw-feed-item.entity.ts
│   │   │   │   └── ports/
│   │   │   │       └── rss-fetcher.port.ts         # interface IRssFetcher
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   └── scrape-feeds.use-case.ts    # Orchestrator: fetch → save → enqueue
│   │   │   │   └── constants/
│   │   │   │       └── feed-sources.ts             # URLs of the three RSS feeds
│   │   │   ├── infrastructure/
│   │   │   │   └── rss/
│   │   │   │       └── axios-rss-fetcher.adapter.ts  # implements IRssFetcher
│   │   │   ├── presentation/
│   │   │   │   └── http/
│   │   │   │       └── scraper.controller.ts       # POST /api/scrape
│   │   │   └── scraper.module.ts
│   │   │
│   │   ├── transformer/                            # LLM Transformation module
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── fake-article.entity.ts
│   │   │   │   └── ports/
│   │   │   │       ├── llm.port.ts                 # interface ILlmProvider
│   │   │   │       └── fake-article.repository.port.ts
│   │   │   ├── application/
│   │   │   │   └── use-cases/
│   │   │   │       └── transform-article.use-case.ts  # Prompt logic + persistence
│   │   │   ├── infrastructure/
│   │   │   │   ├── llm/
│   │   │   │   │   └── openai-llm.adapter.ts       # implements ILlmProvider (openai SDK)
│   │   │   │   ├── persistence/
│   │   │   │   │   └── prisma-fake-article.repository.ts
│   │   │   │   └── queue/
│   │   │   │       ├── transform.producer.ts       # BullMQ: adds job to queue
│   │   │   │       └── transform.consumer.ts       # BullMQ Worker: listens to queue
│   │   │   └── transformer.module.ts
│   │   │
│   │   └── chat/                                   # Chat module
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   │   └── chat-message.entity.ts
│   │       │   └── ports/
│   │       │       └── chat-message.repository.port.ts
│   │       ├── application/
│   │       │   └── use-cases/
│   │       │       ├── send-message.use-case.ts    # user msg → LLM → save both
│   │       │       └── get-chat-history.use-case.ts
│   │       ├── infrastructure/
│   │       │   └── persistence/
│   │       │       └── prisma-chat-message.repository.ts
│   │       ├── presentation/
│   │       │   └── http/
│   │       │       ├── chat.controller.ts
│   │       │       └── chat-message-response.dto.ts
│   │       └── chat.module.ts
│   │
│   ├── shared/                                     # Shared code within NestJS
│   │   ├── database/
│   │   │   └── prisma.service.ts                  # PrismaClient singleton
│   │   ├── config/
│   │   │   └── configuration.ts                   # Joi-validated env schema
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   └── interceptors/
│   │       └── logging.interceptor.ts
│   │
│   ├── app.module.ts
│   └── main.ts                                    # Bootstrap, global pipes, CORS
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── test/
│   └── scraper.e2e-spec.ts
│
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### 4.3 Async Pipeline (Key Concept)

```
POST /api/scrape
       │
       ▼
ScrapeFeedsUseCase
  ├─ IRssFetcher.fetch(url)  × 3 in parallel (Promise.allSettled)
  ├─ Article saved with status=PENDING
  └─ TransformProducer.enqueue(articleId)  ← DO NOT wait for response
       │
       ▼  (asynchronous, BullMQ Worker)
TransformConsumer
  └─ TransformArticleUseCase
       ├─ Article status → TRANSFORMING
       ├─ ILlmProvider.transform(title, description)
       ├─ FakeArticle saved
       └─ Article status → DONE (or FAILED on error)
```

**Why BullMQ instead of a simple setTimeout:**
- Persistence: Jobs are not lost if the service restarts.
- Retry logic out of the box (3 attempts on OpenAI rate limit error).
- Visibility: Can add Bull Board for monitoring.

**Why NOT Piscina/Worker Threads:**
- LLM API calls are I/O-bound (async HTTP), not CPU-bound.
- Worker Threads are for heavy computations (images, compression, crypto).
- Avoids unnecessary complexity.

### 4.4 LLM Integration

**Provider:** Groq Cloud (OpenAI-compatible API, free tier)
**Model:** `llama-3.3-70b-versatile` (or similar available)

**Why this model:**
- Best quality/speed ratio on Groq free tier.
- Excellent at creative/satirical writing.
- 32K context window (sufficient for articles).
- To switch providers, only `.env` changes, code remains untouched.

```typescript
// infrastructure/llm/openai-llm.adapter.ts
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // e.g., https://api.groq.com/openai/v1
});

// Transformation prompt
const TRANSFORM_PROMPT = `You are a satirical news writer. 
Transform the following news article into a humorous, absurd version.
Keep it recognizable but make it funny and exaggerated.
Respond in JSON format: {"fakeTitle": "...", "fakeContent": "..."}

Original title: {title}
Original description: {description}`;

// Chat prompt
const CHAT_SYSTEM_PROMPT = `You are an AI assistant analyzing a news article.
Original article: {originalTitle} — {originalDescription}
Fake version: {fakeTitle} — {fakeContent}

Answer questions about this article concisely and helpfully.`;
```

---

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Source {
  id       String    @id @default(uuid())
  name     String    // "NYT" | "NPR" | "Guardian"
  feedUrl  String    @unique
  articles Article[]

  @@map("sources")
}

model Article {
  id          String         @id @default(uuid())
  sourceId    String
  source      Source         @relation(fields: [sourceId], references: [id])
  title       String
  description String
  originalUrl String         @unique
  publishedAt DateTime
  status      ArticleStatus  @default(PENDING)
  fake        FakeArticle?
  chatMessages ChatMessage[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([sourceId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("articles")
}

enum ArticleStatus {
  PENDING
  TRANSFORMING
  DONE
  FAILED
}

model FakeArticle {
  id          String   @id @default(uuid())
  articleId   String   @unique
  article     Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  fakeTitle   String
  fakeContent String
  createdAt   DateTime @default(now())

  @@map("fake_articles")
}

model ChatMessage {
  id        String      @id @default(uuid())
  articleId String
  article   Article     @relation(fields: [articleId], references: [id], onDelete: Cascade)
  role      MessageRole
  content   String
  createdAt DateTime    @default(now())

  @@index([articleId, createdAt])
  @@map("chat_messages")
}

enum MessageRole {
  USER
  ASSISTANT
}
```

**Schema Decisions:**
- `Article.status` — tracks transformation status, allows UI to show loading states.
- `Article.originalUrl @unique` — prevents duplicates during re-scraping.
- `FakeArticle` — separate table (not JSONB field) for easier indexing/searching.
- `onDelete: Cascade` — deleting an article removes associated fake content and chat history.
- Indexes on `sourceId`, `status`, `createdAt` — optimized for primary query patterns.

---

## 6. API Design

```
POST   /api/scrape                            Trigger scraping (returns 202 Accepted + jobId)
GET    /api/articles?source=NYT&page=1&limit=20  List articles (only DONE status)
GET    /api/articles/:id                      Article detail (original + fake)
POST   /api/articles/:id/chat                 Send message → get AI reply
GET    /api/articles/:id/chat                 Get chat history
GET    /api/health                            Health check
```

**Important Details:**
- `POST /api/scrape` returns `202 Accepted` immediately; transformation runs in the background.
- `GET /api/articles` returns only articles with `DONE` status.
- `GET /api/articles/:id` includes both original and fake versions.
- `POST /api/articles/:id/chat` persists user messages, calls LLM, persists response, returns assistant reply.

**Response Shape (from shared/types):**

```typescript
// packages/shared/src/types/article.types.ts

export type ArticleStatus = 'PENDING' | 'TRANSFORMING' | 'DONE' | 'FAILED';

export interface Source {
  id: string;
  name: string;
}

export interface FakeArticle {
  fakeTitle: string;
  fakeContent: string;
  createdAt: string;
}

export interface Article {
  id: string;
  source: Source;
  title: string;
  description: string;
  originalUrl: string;
  publishedAt: string;
  status: ArticleStatus;
  fake: FakeArticle | null;
  createdAt: string;
}

export interface PaginatedArticles {
  data: Article[];
  total: number;
  page: number;
  limit: number;
}

// packages/shared/src/types/chat.types.ts

export type MessageRole = 'USER' | 'ASSISTANT';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}
```

---

## 7. Frontend — Architecture (Feature-Sliced Design)

### 7.1 FSD Principle

```
app/        ← Next.js App Router (routing, layout, providers only)
features/   ← Isolated features: news-feed, article-detail, chat
entities/   ← Reusable models: article, message
shared/     ← UI kit (shadcn), api client, utilities
```

**Import Rule:** Lower layers do not import from higher layers.
`shared` ← `entities` ← `features` ← `app`

### 7.2 Frontend Folder Structure

```
apps/frontend/
├── src/
│   ├── app/                                        # Next.js App Router
│   │   ├── layout.tsx                              # RootLayout: QueryClientProvider, Toaster
│   │   ├── page.tsx                                # → renders <NewsFeedPage />
│   │   ├── article/
│   │   │   └── [id]/
│   │   │       └── page.tsx                        # → renders <ArticleDetailPage />
│   │   ├── providers.tsx                           # 'use client' — QueryClient + Zustand
│   │   └── globals.css                             # Tailwind base + shadcn vars
│   │
│   ├── features/
│   │   │
│   │   ├── news-feed/                              # News Feed
│   │   │   ├── ui/
│   │   │   │   ├── NewsFeedPage.tsx                # Feature root component
│   │   │   │   ├── ArticleCard.tsx                 # Single article card
│   │   │   │   ├── SourceFilter.tsx                # Source filter (NYT/NPR/Guardian)
│   │   │   │   ├── ScrapeButton.tsx                # "Scrape News" button with loading state
│   │   │   │   └── ArticleCardSkeleton.tsx         # Skeleton for loading state
│   │   │   ├── model/
│   │   │   │   ├── use-articles.ts                 # TanStack Query: GET /api/articles
│   │   │   │   └── use-scrape.ts                   # useMutation: POST /api/scrape
│   │   │   └── api/
│   │   │       └── articles.api.ts                 # fetchArticles(filter)
│   │   │
│   │   ├── article-detail/                         # Detailed View
│   │   │   ├── ui/
│   │   │   │   ├── ArticleDetailPage.tsx           # Feature root component
│   │   │   │   ├── ArticleContent.tsx              # Fake version + toggle to original
│   │   │   │   └── OriginalToggle.tsx              # Switch: show original
│   │   │   ├── model/
│   │   │   │   └── use-article.ts                  # TanStack Query: GET /api/articles/:id
│   │   │   └── api/
│   │   │       └── article.api.ts
│   │   │
│   │   └── chat/                                   # Chat Panel
│   │       ├── ui/
│   │       │   ├── ChatPanel.tsx                   # Chat root component
│   │       │   ├── MessageList.tsx                 # Message list with autoscroll
│   │       │   ├── MessageBubble.tsx               # Single message (user/assistant)
│   │       │   ├── ChatInput.tsx                   # Textarea + Send button
│   │       │   └── SuggestedQuestions.tsx          # Buttons: "Summarize", "Key entities", "What changed"
│   │       ├── model/
│   │       │   ├── use-chat-history.ts             # TanStack Query: GET /api/articles/:id/chat
│   │       │   └── use-send-message.ts             # useMutation: POST /api/articles/:id/chat
│   │       └── api/
│   │           └── chat.api.ts
│   │
│   ├── entities/
│   │   ├── article/
│   │   │   ├── ui/
│   │   │   │   └── ArticleStatusBadge.tsx          # Badge: PENDING/TRANSFORMING/DONE/FAILED
│   │   │   └── lib/
│   │   │       └── format-article-date.ts
│   │   └── message/
│   │       └── lib/
│   │           └── format-message-time.ts
│   │
│   └── shared/
│       ├── ui/                                     # shadcn/ui re-exports
│       │   ├── button.tsx
│       │   ├── card.tsx
│       │   ├── badge.tsx
│       │   ├── input.tsx
│       │   ├── textarea.tsx
│       │   ├── switch.tsx
│       │   ├── skeleton.tsx
│       │   └── separator.tsx
│       ├── api/
│       │   └── http-client.ts                     # axios instance with baseURL from env
│       ├── store/
│       │   └── filter.store.ts                    # Zustand: selectedSource filter
│       └── lib/
│           └── query-client.ts                    # TanStack QueryClient singleton
│
├── components.json                                # shadcn/ui config
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 7.3 Zustand Store (UI State Only)

```typescript
// shared/store/filter.store.ts
interface FilterStore {
  selectedSource: string | null;   // null = all sources
  setSource: (source: string | null) => void;
}
```

**Zustand use case:** Global UI state (filters) required by multiple components simultaneously.

**TanStack Query use case:** All server state (articles, chat history). Do NOT store server data in Zustand.

---

## 8. Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fakenews
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/fakenews
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.groq.com/openai/v1}
      OPENAI_MODEL: ${OPENAI_MODEL:-llama-3.3-70b-versatile}
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "npx prisma migrate deploy && node dist/main.js"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 9. Makefile

```makefile
.PHONY: install dev up down logs migrate seed clean

install:
	pnpm install

dev:
	pnpm --filter backend dev & pnpm --filter frontend dev

up:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	pnpm --filter backend exec prisma migrate dev

migrate-deploy:
	pnpm --filter backend exec prisma migrate deploy

seed:
	pnpm --filter backend exec prisma db seed

studio:
	pnpm --filter backend exec prisma studio

clean:
	docker-compose down -v
	rm -rf apps/backend/dist apps/frontend/.next

rebuild:
	docker-compose down
	docker-compose up --build -d
```

---

## 10. Environment Variables

```bash
# .env.example

# LLM Provider (Groq — free tier, OpenAI-compatible)
# Get free key at: https://console.groq.com/keys
OPENAI_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.3-70b-versatile

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fakenews

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PORT=3001
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 11. pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// package.json (root)
{
  "name": "fake-news-generator",
  "private": true,
  "scripts": {
    "dev": "make dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

---

## 12. Key Implementation Details

### 12.1 Scraper — Duplicate Protection

```typescript
// scrape-feeds.use-case.ts
// When re-running the scraper, do not create duplicates
await prisma.article.upsert({
  where: { originalUrl: item.url },
  create: { ...articleData, status: 'PENDING' },
  update: {}, // do nothing if it already exists
});
// Enqueue only if the article is new (status=PENDING)
```

### 12.2 BullMQ — Retry on LLM Failure

```typescript
// transform.consumer.ts
@Processor('transform', {
  concurrency: 3,  // 3 parallel workers
})
export class TransformConsumer extends WorkerHost {
  // BullMQ automatically retries on exceptions
  // defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
}
```

### 12.3 Chat — Context Window Management

```typescript
// send-message.use-case.ts
// Last 10 messages for context (saving tokens)
const history = await chatRepo.getLastN(articleId, 10);
const messages = [
  { role: 'system', content: buildSystemPrompt(article) },
  ...history.map(m => ({ role: m.role.toLowerCase(), content: m.content })),
  { role: 'user', content: userMessage },
];
```

### 12.4 Frontend — Optimistic UI for Chat

```typescript
// use-send-message.ts
const mutation = useMutation({
  mutationFn: sendMessage,
  onMutate: async (newMessage) => {
    // Optimistically add user message
    queryClient.setQueryData(['chat', articleId], (old) => ({
      ...old,
      messages: [...old.messages, { role: 'USER', content: newMessage, id: 'temp' }]
    }));
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['chat', articleId] });
  },
});
```

### 12.5 Error Handling

- `GlobalExceptionFilter` on backend catches all errors → structured JSON response.
- BullMQ: If status is `FAILED`, store the `errorMessage` on the article record.
- Frontend: TanStack Query `error` state → toast notification via shadcn/ui `Toaster`.
- RSS fetch: `Promise.allSettled` — if one feed fails, others continue parsing.

---

## 13. RSS Feed Sources (Constants)

```typescript
// scraper/application/constants/feed-sources.ts
export const FEED_SOURCES = [
  {
    name: 'NYT',
    feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  },
  {
    name: 'NPR',
    feedUrl: 'https://feeds.npr.org/1001/rss.xml',
  },
  {
    name: 'Guardian',
    feedUrl: 'https://www.theguardian.com/world/rss',
  },
] as const;
```

---

## 14. AI Skills and MCP for IDE (WebStorm)

Install via terminal:

```bash
# shadcn/ui components
pnpm pnpm dlx skills add shadcn/ui 
pnpm pnpm dlx skills add Kadajett/agent-nestjs-skills
pnpm pnpm dlx skills add vercel-labs/agent-skills
pnpm pnpm dlx add-mcp next-devtools-mcp@latest
pnpm pnpm dlx get-shit-done-cc@latest

# NestJS skills / snippets — built into WebStorm NestJS plugin
# Recommended plugins:
# - NestJS Files (WebStorm Marketplace)
# - Prisma (official, schema.prisma highlighting)
# - Tailwind CSS IntelliSense
```

**Rules for AI during code generation:**
1. NestJS: Always use `@Injectable()`, register in `.module.ts`.
2. Prisma: Always type via `Prisma.ArticleGetPayload<typeof query>`.
3. Next.js: Pages in `app/` are Server Components by default; `'use client'` only when hooks are needed.
4. shadcn/ui: Import from `@/shared/ui/`, not directly from `@/components/ui/`.
5. Do not use `any` — use `unknown` + type guards if the type is unknown.

---

## 15. Implementation Plan (4 Hours)

| Task                                                   |
|--------------------------------------------------------|
| Monorepo setup: pnpm workspaces, package.json, tsconfigs |
| docker-compose.yml, .env.example, Makefile             |
| Prisma schema + migration + PrismaService              |
| Scraper module (RSS fetch → save → enqueue)            |
| Transformer module (BullMQ worker → OpenAI → save)     |
| Articles module (GET endpoints) |
| Chat module (POST/GET endpoints) |
| shared/types, shared packages, http-client |
| Frontend: news-feed + article-detail features |
| Frontend: chat feature + README + `docker-compose up` test |

---
