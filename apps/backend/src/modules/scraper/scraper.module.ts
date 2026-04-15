import { Module } from '@nestjs/common';
import { ScrapeFeedsUseCase } from './application/use-cases/scrape-feeds.use-case';
import { ScraperController } from './presentation/http/scraper.controller';
import { SCRAPER_TOKENS } from './scraper.tokens';
import { AxiosRssFetcherAdapter } from './infrastructure/rss/axios-rss-fetcher.adapter';
import { PrismaArticleRepository } from './infrastructure/persistence/prisma-article.repository';
import { ScrapeScheduler } from './application/scheduler/scrape.scheduler';
import { TransformerModule } from '../transformer/transformer.module';

@Module({
  imports: [TransformerModule],
  controllers: [ScraperController],
  providers: [
    ScrapeFeedsUseCase,
    ScrapeScheduler,
    { provide: SCRAPER_TOKENS.rssFetcher, useClass: AxiosRssFetcherAdapter },
    {
      provide: SCRAPER_TOKENS.articleRepository,
      useClass: PrismaArticleRepository,
    },
  ],
})
export class ScraperModule {}
