import { Module } from '@nestjs/common';
import { TransformQueueProducer } from './infrastructure/queue/transform-queue.producer';
import { TransformWorkerService } from './infrastructure/queue/transform.worker';
import { SCRAPER_TOKENS } from '../scraper/scraper.tokens';

@Module({
  providers: [
    TransformWorkerService,
    TransformQueueProducer,
    // Expose producer for scraper use-case via scraper token
    {
      provide: SCRAPER_TOKENS.transformQueue,
      useExisting: TransformQueueProducer,
    },
  ],
  exports: [TransformQueueProducer, SCRAPER_TOKENS.transformQueue],
})
export class TransformerModule {}
