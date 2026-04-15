import type { SourcesSummary } from '@fakenews/shared';

export interface SourceQueryPort {
  summary(): Promise<SourcesSummary>;
}
