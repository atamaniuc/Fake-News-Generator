import { Module } from '@nestjs/common';
import { SourcesController } from './presentation/http/sources.controller';
import { PrismaSourceQuery } from './infrastructure/persistence/prisma-source.query';
import { GetSourcesSummaryUseCase } from './application/use-cases/get-sources-summary.use-case';
import { SOURCES_TOKENS } from './sources.tokens';
import { SourcesSeeder } from './application/seed/sources.seeder';

@Module({
  controllers: [SourcesController],
  providers: [
    PrismaSourceQuery,
    SourcesSeeder,
    GetSourcesSummaryUseCase,
    { provide: SOURCES_TOKENS.sourceQuery, useExisting: PrismaSourceQuery },
  ],
})
export class SourcesModule {}
