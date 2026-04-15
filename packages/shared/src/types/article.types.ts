export type ArticleStatus = 'PENDING' | 'TRANSFORMING' | 'DONE' | 'FAILED';

export interface Source {
  id: string;
  name: string;
}

export interface FakeArticle {
  fakeTitle: string;
  fakeContent: string;
  createdAt: string;
}

export interface ArticleListItem {
  id: string;
  source: Source;
  title: string;
  description: string;
  originalUrl: string;
  publishedAt: string;
  status: ArticleStatus;
  fake: FakeArticle | null;
  createdAt: string;
}

export interface ArticleDetail extends ArticleListItem {}

export interface PaginatedArticles {
  data: ArticleListItem[];
  total: number;
  page: number;
  limit: number;
}

