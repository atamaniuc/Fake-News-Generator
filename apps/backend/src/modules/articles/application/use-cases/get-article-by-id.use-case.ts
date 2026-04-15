import { Inject, Injectable } from '@nestjs/common';
import type { ArticleDetail } from '@fakenews/shared';
import type { ArticleQueryPort } from '../../domain/ports/article.query.port';
import { ARTICLES_TOKENS } from '../../articles.tokens';

@Injectable()
export class GetArticleByIdUseCase {
  constructor(
    @Inject(ARTICLES_TOKENS.articleQuery)
    private readonly articleQuery: ArticleQueryPort,
  ) {}

  async execute(id: string): Promise<ArticleDetail | null> {
    return this.articleQuery.getById(id);
  }
}
