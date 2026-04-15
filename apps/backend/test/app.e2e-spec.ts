import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ScraperController } from '../src/modules/scraper/presentation/http/scraper.controller';
import { ScrapeFeedsUseCase } from '../src/modules/scraper/application/use-cases/scrape-feeds.use-case';
import { SCRAPER_TOKENS } from '../src/modules/scraper/scraper.tokens';
import { HealthController } from '../src/modules/health/health.controller';

describe('App (e2e, minimal)', () => {
  let moduleFixture: TestingModule;
  let health: HealthController;
  let scraper: ScraperController;

  beforeEach(async () => {
    const mockUseCase: Pick<ScrapeFeedsUseCase, 'execute'> = {
      execute: vi.fn().mockResolvedValue({ created: 0, enqueued: 0 }),
    };

    moduleFixture = await Test.createTestingModule({
      controllers: [HealthController, ScraperController],
      providers: [
        { provide: ScrapeFeedsUseCase, useValue: mockUseCase },
        // keep tokens present so module wiring doesn’t matter here
        { provide: SCRAPER_TOKENS.rssFetcher, useValue: {} },
        { provide: SCRAPER_TOKENS.articleRepository, useValue: {} },
        { provide: SCRAPER_TOKENS.transformQueue, useValue: {} },
      ],
    }).compile();

    health = moduleFixture.get(HealthController);
    scraper = moduleFixture.get(ScraperController);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('/api/health (GET)', () => {
    expect(health.health()).toEqual({ ok: true });
  });

  it('/api/scrape (POST) returns 202', async () => {
    await expect(scraper.scrape()).resolves.toEqual({
      created: 0,
      enqueued: 0,
    });
  });
});
