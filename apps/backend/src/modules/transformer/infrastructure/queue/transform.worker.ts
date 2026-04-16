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

/**
 * TransformWorkerService is a NestJS service responsible for managing a BullMQ worker
 * that processes jobs from a specified queue. It sets up the worker on module
 * initialization and ensures the worker is closed on module destruction.
 *
 * Implements:
 * - OnModuleInit: Initializes resources when the module is loaded.
 * - OnModuleDestroy: Cleans up resources when the module is unloaded.
 *
 * Key Functionality:
 * - Configures worker concurrency based on environment variables and API key properties.
 * - Uses a processor file to handle queue jobs in a separate Node.js process for improved scalability and isolation.
 * - Logs errors for failed jobs.
 *
 * Dependencies:
 * - Injects a Redis connection for BullMQ operations.
 *
 * Events:
 * - Listens for the 'failed' event on the worker to log job errors, including the reason for the failure.
 */
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
