import { Injectable } from '@nestjs/common';
import type {
  ArticleRepositoryPort,
  UpsertArticleInput,
} from '../../domain/ports/article.repository.port';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { jaccard, tokenize } from '../../../../shared/utils/similarity';

@Injectable()
export class PrismaArticleRepository implements ArticleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByOriginalUrl(
    item: UpsertArticleInput,
  ): Promise<{ created: boolean; articleId: string }> {
    const existing = await this.prisma.article.findUnique({
      where: { originalUrl: item.url },
      select: { id: true },
    });
    if (existing) return { created: false, articleId: existing.id };

    const source = await this.prisma.source.upsert({
      where: { feedUrl: item.sourceFeedUrl },
      update: { name: item.sourceName },
      create: { name: item.sourceName, feedUrl: item.sourceFeedUrl },
      select: { id: true },
    });

    // Bonus: near-duplicate detection across sources (lightweight heuristic).
    // If a very similar title from a different source appeared recently, skip creating/enqueueing.
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const candidates = await this.prisma.article.findMany({
      where: {
        publishedAt: { gte: since },
        sourceId: { not: source.id },
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: { id: true, title: true },
    });
    const tokens = tokenize(item.title);
    for (const c of candidates) {
      if (jaccard(tokens, tokenize(c.title)) >= 0.75) {
        return { created: false, articleId: c.id };
      }
    }

    const created = await this.prisma.article.create({
      data: {
        sourceId: source.id,
        title: item.title,
        description: item.description,
        originalUrl: item.url,
        publishedAt: item.publishedAt,
        status: 'PENDING',
      },
      select: { id: true },
    });

    return { created: true, articleId: created.id };
  }
}
