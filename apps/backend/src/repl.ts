import { repl } from '@nestjs/core';

async function bootstrap() {
  // REPL is a dev tool; provide defaults so it can run without exporting all env vars.
  process.env.OPENAI_API_KEY ||= 'dev-dummy';
  process.env.OPENAI_MODEL ||= 'gpt-5.4-nano';
  process.env.DATABASE_URL ||=
    'postgresql://postgres:postgres@localhost:5432/fakenews';
  process.env.REDIS_URL ||= 'redis://localhost:6379';

  const mod =
    (await import('./app.module.js')) as typeof import('./app.module.js');
  await repl(mod.AppModule);
}

void bootstrap();
