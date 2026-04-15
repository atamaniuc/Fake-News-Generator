import type { ArticleDetail, PaginatedArticles } from '@fakenews/shared';

export type ArticleListQuery = {
  source?: string | null;
  page: number;
  limit: number;
};

export interface ArticleQueryPort {
  list(query: ArticleListQuery): Promise<PaginatedArticles>;
  getById(id: string): Promise<ArticleDetail | null>;
  assertExists(id: string): Promise<void>;
}
