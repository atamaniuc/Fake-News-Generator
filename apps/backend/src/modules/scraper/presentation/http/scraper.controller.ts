import { Controller, HttpCode, Post } from '@nestjs/common';
import { ScrapeFeedsUseCase } from '../../application/use-cases/scrape-feeds.use-case';

@Controller('/api/scrape')
export class ScraperController {
  constructor(private readonly scrapeFeeds: ScrapeFeedsUseCase) {}

  @Post()
  @HttpCode(202)
  async scrape() {
    // Returns immediately; work happens asynchronously (queue-backed later).
    return this.scrapeFeeds.execute();
  }
}
