import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { REDIS_TOKENS } from '../../../../shared/redis/redis.tokens';
import { TRANSFORM_QUEUE_NAME } from '../../transformer.constants';
import type { TransformQueuePort } from '../../../scraper/domain/ports/transform-queue.port';

@Injectable()
export class TransformQueueProducer
  implements TransformQueuePort, OnModuleDestroy
{
  private readonly queue: Queue<{ articleId: string }>;

  constructor(@Inject(REDIS_TOKENS.connection) redis: Redis) {
    this.queue = new Queue(TRANSFORM_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueueTransform(articleId: string): Promise<void> {
    await this.queue.add('transform-article', { articleId });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
