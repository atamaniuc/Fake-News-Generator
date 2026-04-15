import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ArticleRepositoryPort } from '../../domain/ports/article.repository.port';
import type { RssFetcherPort } from '../../domain/ports/rss-fetcher.port';
import type { TransformQueuePort } from '../../domain/ports/transform-queue.port';
import { FEED_SOURCES } from '../constants/feed-sources';
import { SCRAPER_TOKENS } from '../../scraper.tokens';

@Injectable()
export class ScrapeFeedsUseCase {
  private readonly logger = new Logger(ScrapeFeedsUseCase.name);

  constructor(
    @Inject(SCRAPER_TOKENS.rssFetcher)
    private readonly rssFetcher: RssFetcherPort,
    @Inject(SCRAPER_TOKENS.articleRepository)
    private readonly articleRepo: ArticleRepositoryPort,
    @Inject(SCRAPER_TOKENS.transformQueue)
    private readonly transformQueue: TransformQueuePort,
  ) {}

  async execute(): Promise<{ created: number; enqueued: number }> {
    const settled = await Promise.allSettled(
      FEED_SOURCES.map((s) => this.rssFetcher.fetch(s.feedUrl)),
    );

    settled.forEach((r, idx) => {
      if (r.status === 'rejected') {
        const src = FEED_SOURCES[idx];
        this.logger.warn(
          `Feed fetch failed (${src.name}): ${src.feedUrl} (${String(r.reason)})`,
        );
      }
    });

    const items = settled
      .flatMap((r, idx) => {
        if (r.status !== 'fulfilled') return [];
        const src = FEED_SOURCES[idx];
        return r.value.map((item) => ({
          ...item,
          sourceName: src.name,
          sourceFeedUrl: src.feedUrl,
        }));
      })
      // naive intra-run dedupe by URL to avoid enqueuing twice on bad feeds
      .filter(
        (item, idx, arr) => arr.findIndex((x) => x.url === item.url) === idx,
      );

    let created = 0;
    let enqueued = 0;

    for (const item of items) {
      const res = await this.articleRepo.upsertByOriginalUrl(item);
      if (!res.created) continue;
      created += 1;
      await this.transformQueue.enqueueTransform(res.articleId);
      enqueued += 1;
    }

    return { created, enqueued };
  }
}
