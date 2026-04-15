import type { ArticleDetail } from '@fakenews/shared';
import { httpClient } from '../../../shared/api/http-client';

export async function fetchArticle(id: string): Promise<ArticleDetail> {
  const res = await httpClient.get<ArticleDetail>(`/api/articles/${id}`);
  return res.data;
}

