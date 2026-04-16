import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { REDIS_TOKENS } from '../../../../shared/redis/redis.tokens';
import { TRANSFORM_QUEUE_NAME } from '../../transformer.constants';
import type { TransformQueuePort } from '../../../scraper/domain/ports/transform-queue.port';

/**
 * An injectable service that produces transformation jobs and manages their lifecycle within a queue.
 *
 * This class is responsible for enqueuing transformation tasks for articles. It interacts with a Redis-based
 * queue and ensures that tasks are properly configured with retry attempts, exponential backoff, and cleanup behavior.
 *
 * It implements the `TransformQueuePort` interface for external usage and `OnModuleDestroy` lifecycle hook to perform
 * cleanup when the module is destroyed.
 *
 * Dependencies:
 * - A Redis connection is injected in the constructor to configure the queue.
 *
 * Behavior:
 * - Jobs are enqueued with a specific configuration (e.g., retry attempts, backoff policy).
 * - Ensures proper cleanup by closing the queue when the module is destroyed.
 */
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
