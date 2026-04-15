import type { PaginatedArticles } from '@fakenews/shared';
import { httpClient } from '../../../shared/api/http-client';

export async function fetchArticles(params: {
  source?: string | null;
  page: number;
  limit: number;
}): Promise<PaginatedArticles> {
  const res = await httpClient.get<PaginatedArticles>('/api/articles', { params });
  return res.data;
}

export async function triggerScrape(): Promise<{ created: number; enqueued: number }> {
  const res = await httpClient.post<{ created: number; enqueued: number }>('/api/scrape', {});
  return res.data;
}

