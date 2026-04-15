import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { ScrapeFeedsUseCase } from './scrape-feeds.use-case';
import { SCRAPER_TOKENS } from '../../scraper.tokens';

describe(ScrapeFeedsUseCase.name, () => {
  it('dedupes items by URL and enqueues transform only for newly created articles', async () => {
    const rssFetcher = {
      fetch: vi.fn(),
    };
    const articleRepo = {
      upsertByOriginalUrl: vi.fn(),
    };
    const transformQueue = {
      enqueueTransform: vi.fn(),
    };

    const now = new Date('2026-04-14T00:00:00.000Z');
    rssFetcher.fetch
      .mockResolvedValueOnce([
        {
          title: 'A',
          description: 'D',
          url: 'https://example.com/1',
          publishedAt: now,
        },
        {
          title: 'A (dup)',
          description: 'D',
          url: 'https://example.com/1',
          publishedAt: now,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    articleRepo.upsertByOriginalUrl.mockResolvedValue({
      created: true,
      articleId: 'id-1',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScrapeFeedsUseCase,
        { provide: SCRAPER_TOKENS.rssFetcher, useValue: rssFetcher },
        { provide: SCRAPER_TOKENS.articleRepository, useValue: articleRepo },
        { provide: SCRAPER_TOKENS.transformQueue, useValue: transformQueue },
      ],
    }).compile();

    const uc = moduleRef.get(ScrapeFeedsUseCase);
    const res = await uc.execute();

    expect(rssFetcher.fetch).toHaveBeenCalledTimes(3);
    expect(articleRepo.upsertByOriginalUrl).toHaveBeenCalledTimes(1);
    expect(transformQueue.enqueueTransform).toHaveBeenCalledTimes(1);
    expect(transformQueue.enqueueTransform).toHaveBeenCalledWith('id-1');
    expect(res).toEqual({ created: 1, enqueued: 1 });
  });
});
