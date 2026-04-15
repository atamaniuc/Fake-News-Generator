import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArticleDetail,
  ArticleListItem,
  PaginatedArticles,
} from '@fakenews/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import type {
  ArticleListQuery,
  ArticleQueryPort,
} from '../../domain/ports/article.query.port';

function toIso(d: Date): string {
  return d.toISOString();
}

@Injectable()
export class PrismaArticleQuery implements ArticleQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ArticleListQuery): Promise<PaginatedArticles> {
    const page = Math.max(1, Math.floor(query.page));
    const limit = Math.min(50, Math.max(1, Math.floor(query.limit)));
    const skip = (page - 1) * limit;

    const where: Prisma.ArticleWhereInput = {
      status: 'DONE',
    };
    if (query.source) {
      where.source = { name: query.source };
    }

    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { source: true, fake: true },
      }),
    ]);

    const data: ArticleListItem[] = rows.map((a) => ({
      id: a.id,
      source: { id: a.source.id, name: a.source.name },
      title: a.title,
      description: a.description,
      originalUrl: a.originalUrl,
      publishedAt: toIso(a.publishedAt),
      status: a.status,
      fake: a.fake
        ? {
            fakeTitle: a.fake.fakeTitle,
            fakeContent: a.fake.fakeContent,
            createdAt: toIso(a.fake.createdAt),
          }
        : null,
      createdAt: toIso(a.createdAt),
    }));

    return { data, total, page, limit };
  }

  async getById(id: string): Promise<ArticleDetail | null> {
    const a = await this.prisma.article.findUnique({
      where: { id },
      include: { source: true, fake: true },
    });
    if (!a) return null;

    return {
      id: a.id,
      source: { id: a.source.id, name: a.source.name },
      title: a.title,
      description: a.description,
      originalUrl: a.originalUrl,
      publishedAt: toIso(a.publishedAt),
      status: a.status,
      fake: a.fake
        ? {
            fakeTitle: a.fake.fakeTitle,
            fakeContent: a.fake.fakeContent,
            createdAt: toIso(a.fake.createdAt),
          }
        : null,
      createdAt: toIso(a.createdAt),
    };
  }

  async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Article not found');
  }
}
