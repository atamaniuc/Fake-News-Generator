import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ScrapeFeedsUseCase } from '../use-cases/scrape-feeds.use-case';
import { getErrorMessage } from '../../../../shared/utils/errors';

type ScrapeMode = 'startup' | 'cron';

@Injectable()
export class ScrapeScheduler implements OnModuleInit {
  private readonly logger = new Logger(ScrapeScheduler.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly scrapeFeeds: ScrapeFeedsUseCase,
  ) {}

    private async runScrape(scrapeMode: ScrapeMode): Promise<void> {
    if (this.running) {
      this.logger.warn(`Scrape already running, skipping (${scrapeMode})`);
      return;
    }
    this.running = true;
    this.logger.log(`Scrape started (${scrapeMode})`);
    try {
      await this.scrapeFeeds.execute();
      this.logger.log(`Scrape finished (${scrapeMode})`);
    } catch (e: unknown) {
      this.logger.error(`Scrape failed (${scrapeMode}): ${getErrorMessage(e)}`);
    } finally {
      this.running = false;
    }
  }

  onModuleInit() {
    const cronExprRaw =
      this.config.get<string>('SCRAPE_CRON', { infer: true }) ?? '';
    const cronExpr = cronExprRaw.trim() || '*/5 * * * *'; // each 5 mins

    // Run immediately on startup, then continue on the cron schedule.
    void this.runScrape('startup');

    const job = new CronJob(cronExpr, async () => {
      await this.runScrape('cron');
    });

    this.scheduler.addCronJob('scrape-cron', job);
    job.start();
    this.logger.log(
      `Scheduled scraping enabled with SCRAPE_CRON="${cronExpr}"`,
    );
  }
}
