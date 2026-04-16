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

  /**
   * Inserts or updates an article based on its original URL. If the article already exists, it returns the existing article ID.
   * Otherwise, it creates a new article after checking for near-duplicate titles and returns the newly created article ID.
   * Scenario:
   * - First, it checks if an article with the same original URL already exists. If it does, it returns the existing article ID.
   * - If no article with the same URL exists, it creates a new source entry if it doesn't exist yet.
   * - Then, it checks for near-duplicate titles across all sources (lightweight heuristic).
   *   If a very similar title from a different source appeared recently, it skips creating/enqueueing.
   * - Finally, it creates a new article with the provided details.
   *
   * @param {UpsertArticleInput} item - The input object containing article details such as title, description, original URL, source information, and published date.
   * @return {Promise<{ created: boolean; articleId: string }>} An object indicating whether a new article was created and the ID of the article.
   */
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
