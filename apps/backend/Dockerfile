FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN pnpm --filter @fakenews/shared build
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /app
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN pnpm --filter @fakenews/shared build
EXPOSE 3001 9229
CMD ["sh", "-c", "cd /app && CI=true pnpm install --frozen-lockfile && pnpm --filter @fakenews/shared build && pnpm --filter backend prisma:generate && pnpm --filter backend start:debug"]

FROM base AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
EXPOSE 3001
CMD ["sh", "-c", "cd /app/apps/backend && ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && node /app/apps/backend/dist/main.js"]
