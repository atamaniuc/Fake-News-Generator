FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
RUN pnpm --filter @fakenews/shared build
RUN pnpm --filter frontend build

FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /app
COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
RUN pnpm --filter @fakenews/shared build
EXPOSE 3000
CMD ["sh", "-c", "cd /app && CI=true pnpm install --frozen-lockfile && pnpm --filter frontend dev"]

FROM base AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
COPY --from=build /app/apps/frontend/package.json ./apps/frontend/package.json
EXPOSE 3000
CMD ["sh", "-c", "cd /app/apps/frontend && ./node_modules/.bin/next start -p 3000"]
