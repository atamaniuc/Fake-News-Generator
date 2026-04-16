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

  /**
   * Executes the scraping process for the specified mode. Handles logging and error reporting during the process.
   *
   * @param {ScrapeMode} scrapeMode - The mode in which the scrape should be executed ('startup' | 'cron').
   * @return {Promise<void>} A promise that resolves when the scraping process completes.
   */
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

  /**
   * Initializes the module by setting up a cron job for periodic scraping tasks.
   * It runs the scraping immediately on the startup and then schedules it based on a cron expression.
   * The cron expression can be configured using the `SCRAPE_CRON` environment variable,
   * defaulting to each 5 minutes.
   */
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
