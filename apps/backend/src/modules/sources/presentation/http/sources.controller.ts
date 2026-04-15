import { Controller, Get } from '@nestjs/common';
import { GetSourcesSummaryUseCase } from '../../application/use-cases/get-sources-summary.use-case';

@Controller('/api/sources')
export class SourcesController {
  constructor(private readonly getSummary: GetSourcesSummaryUseCase) {}

  @Get()
  async summary() {
    return this.getSummary.execute();
  }
}
