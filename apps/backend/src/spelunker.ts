import { SpelunkerModule } from 'nestjs-spelunker';
import type { INestApplication } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { PrismaService } from './shared/database/prisma.service';
import { REDIS_TOKENS } from './shared/redis/redis.tokens';
import { OPENAI_TOKENS } from './shared/llm/openai.tokens';

function generateAppGraph(app: INestApplication): void {
  const tree = SpelunkerModule.explore(app, {});
  const root = SpelunkerModule.graph(tree);
  const edges = SpelunkerModule.findGraphEdges(root);

  const sorted = edges.sort((a, b) => {
    const fromCmp = a.from.module.name.localeCompare(b.from.module.name);
    if (fromCmp !== 0) return fromCmp;
    return a.to.module.name.localeCompare(b.to.module.name);
  });

  let graph = 'graph LR\n';
  for (const { from, to } of sorted) {
    graph += `  ${from.module.name}-->${to.module.name}\n`;
  }

  // If executed from `apps/backend`, write to repo-root `docs/diagrams`.
  const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'diagrams');
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, 'nest-modules.mmd');
  fs.writeFileSync(filePath, graph, { encoding: 'utf-8' });

  console.log(`\nGraph written to ${filePath}\n`);
}

async function bootstrap() {
  // Spelunker is a dev tool; provide defaults so it can run without exporting all env vars.
  process.env.OPENAI_API_KEY ||= 'dev-dummy';
  process.env.OPENAI_MODEL ||= 'gpt-5.4-nano';
  process.env.DATABASE_URL ||=
    'postgresql://postgres:postgres@localhost:5432/fakenews';
  process.env.REDIS_URL ||= 'redis://localhost:6379';

  // Use TestingModule + provider overrides so we don't attempt real DB/Redis connections.

  const mod =
    (await import('./app.module.js')) as typeof import('./app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [mod.AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(REDIS_TOKENS.connection)
    .useValue({})
    .overrideProvider(OPENAI_TOKENS.client)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  try {
    generateAppGraph(app);
  } finally {
    await app.close();
    await moduleRef.close();
  }
}

bootstrap().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
