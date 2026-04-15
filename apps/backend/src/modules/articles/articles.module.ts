import { Module } from '@nestjs/common';
import { ArticlesController } from './presentation/http/articles.controller';
import { GetArticlesUseCase } from './application/use-cases/get-articles.use-case';
import { GetArticleByIdUseCase } from './application/use-cases/get-article-by-id.use-case';
import { PrismaArticleQuery } from './infrastructure/persistence/prisma-article.query';
import { ARTICLES_TOKENS } from './articles.tokens';

@Module({
  controllers: [ArticlesController],
  providers: [
    GetArticlesUseCase,
    GetArticleByIdUseCase,
    PrismaArticleQuery,
    { provide: ARTICLES_TOKENS.articleQuery, useExisting: PrismaArticleQuery },
  ],
})
export class ArticlesModule {}
