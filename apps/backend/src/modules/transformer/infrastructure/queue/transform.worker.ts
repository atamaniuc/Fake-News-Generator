import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { join } from 'path';
import type Redis from 'ioredis';
import { REDIS_TOKENS } from '../../../../shared/redis/redis.tokens';
import { TRANSFORM_QUEUE_NAME } from '../../transformer.constants';

@Injectable()
export class TransformWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransformWorkerService.name);
  private worker?: Worker;

  constructor(@Inject(REDIS_TOKENS.connection) private readonly redis: Redis) {}

  onModuleInit() {
    // Passing a processor file path makes BullMQ run jobs in a separate Node.js process (sandboxed).
    const processorFile = join(__dirname, 'transform.processor.js');
    const key = String(process.env.OPENAI_API_KEY ?? '');
    const defaultConcurrency = key.startsWith('gsk_') ? 1 : 3;
    const concurrency = Number(
      process.env.TRANSFORM_CONCURRENCY ?? defaultConcurrency,
    );
    this.worker = new Worker(TRANSFORM_QUEUE_NAME, processorFile, {
      connection: this.redis,
      concurrency:
        Number.isFinite(concurrency) && concurrency > 0
          ? concurrency
          : defaultConcurrency,
    });

    this.worker.on('failed', (job, err: Error) => {
      this.logger.error(`Job failed ${job?.id}: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
