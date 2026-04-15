import { Inject, Injectable } from '@nestjs/common';
import type { SourcesSummary } from '@fakenews/shared';
import { SOURCES_TOKENS } from '../../sources.tokens';
import type { SourceQueryPort } from '../../domain/ports/source.query.port';

@Injectable()
export class GetSourcesSummaryUseCase {
  constructor(
    @Inject(SOURCES_TOKENS.sourceQuery)
    private readonly sourceQuery: SourceQueryPort,
  ) {}

  async execute(): Promise<SourcesSummary> {
    return this.sourceQuery.summary();
  }
}
