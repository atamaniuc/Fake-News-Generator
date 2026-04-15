import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { GetArticlesUseCase } from '../../application/use-cases/get-articles.use-case';
import { GetArticleByIdUseCase } from '../../application/use-cases/get-article-by-id.use-case';

@Controller('/api/articles')
export class ArticlesController {
  constructor(
    private readonly getArticles: GetArticlesUseCase,
    private readonly getArticleById: GetArticleByIdUseCase,
  ) {}

  @Get()
  async list(
    @Query('source') source?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = pageStr ? Number(pageStr) : 1;
    const limit = limitStr ? Number(limitStr) : 20;
    return this.getArticles.execute({ source: source ?? null, page, limit });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const res = await this.getArticleById.execute(id);
    if (!res) throw new NotFoundException('Article not found');
    return res;
  }
}
