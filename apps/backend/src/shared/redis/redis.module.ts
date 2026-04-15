import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_TOKENS } from './redis.tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKENS.connection,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL', { infer: true });
        if (!url) throw new Error('REDIS_URL is required');
        return new Redis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_TOKENS.connection],
})
export class RedisModule {}
