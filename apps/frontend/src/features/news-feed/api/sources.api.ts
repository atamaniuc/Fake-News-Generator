import type { SourcesSummary } from '@fakenews/shared';
import { httpClient } from '../../../shared/api/http-client';

export async function fetchSourcesSummary(): Promise<SourcesSummary> {
  const res = await httpClient.get<SourcesSummary>('/api/sources');
  return res.data;
}

