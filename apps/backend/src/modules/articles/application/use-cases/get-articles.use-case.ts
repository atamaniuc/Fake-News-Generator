import { Inject, Injectable } from '@nestjs/common';
import type { PaginatedArticles } from '@fakenews/shared';
import type { ArticleFilterDto } from '../dtos/article-filter.dto';
import type { ArticleQueryPort } from '../../domain/ports/article.query.port';
import { ARTICLES_TOKENS } from '../../articles.tokens';

@Injectable()
export class GetArticlesUseCase {
  constructor(
    @Inject(ARTICLES_TOKENS.articleQuery)
    private readonly articleQuery: ArticleQueryPort,
  ) {}

  async execute(filter: ArticleFilterDto): Promise<PaginatedArticles> {
    return this.articleQuery.list({
      source: filter.source ?? null,
      page: filter.page,
      limit: filter.limit,
    });
  }
}
