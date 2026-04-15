import { Module } from '@nestjs/common';
import { ScraperModule } from './modules/scraper/scraper.module';
import { AppConfigModule } from './shared/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { OpenAiModule } from './shared/llm/openai.module';
import { RedisModule } from './shared/redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ArticlesModule } from './modules/articles/articles.module';
import { HealthController } from './modules/health/health.controller';
import { ChatModule } from './modules/chat/chat.module';
import { SourcesModule } from './modules/sources/sources.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    OpenAiModule,
    ScheduleModule.forRoot(),
    ScraperModule,
    ArticlesModule,
    ChatModule,
    SourcesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
