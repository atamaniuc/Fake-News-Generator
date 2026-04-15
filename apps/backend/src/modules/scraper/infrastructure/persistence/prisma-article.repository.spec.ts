import { describe, expect, it, vi } from 'vitest';
import { PrismaArticleRepository } from './prisma-article.repository';
import type { PrismaService } from '../../../../shared/database/prisma.service';

function makePrismaMock(overrides?: Partial<any>) {
  return {
    article: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    source: {
      upsert: vi.fn(),
    },
    ...overrides,
  };
}

describe('PrismaArticleRepository (near-duplicate detection)', () => {
  it('skips creating a new article when a near-duplicate title exists from another source', async () => {
    const prisma = makePrismaMock();
    prisma.article.findUnique.mockResolvedValueOnce(null);
    prisma.source.upsert.mockResolvedValueOnce({ id: 'source-new' });

    prisma.article.findMany.mockResolvedValueOnce([
      {
        id: 'existing-1',
        title:
          'OpenAI unveils new GPT model as developers celebrate faster builds and fewer bugs',
      },
    ]);

    const repo = new PrismaArticleRepository(
      prisma as unknown as PrismaService,
    );
    const res = await repo.upsertByOriginalUrl({
      url: 'https://example.com/new',
      sourceName: 'NPR',
      sourceFeedUrl: 'https://example.com/feed.xml',
      title:
        'OpenAI unveils new GPT model; developers celebrate faster builds & fewer bugs!',
      description: 'desc',
      publishedAt: new Date(),
    });

    expect(res).toEqual({ created: false, articleId: 'existing-1' });
    expect(prisma.article.create).not.toHaveBeenCalled();
  });

  it('creates a new article when titles are not near-duplicates', async () => {
    const prisma = makePrismaMock();
    prisma.article.findUnique.mockResolvedValueOnce(null);
    prisma.source.upsert.mockResolvedValueOnce({ id: 'source-new' });

    prisma.article.findMany.mockResolvedValueOnce([
      {
        id: 'existing-1',
        title: 'Local sports team wins championship in dramatic fashion',
      },
    ]);

    prisma.article.create.mockResolvedValueOnce({ id: 'created-1' });

    const repo = new PrismaArticleRepository(
      prisma as unknown as PrismaService,
    );
    const res = await repo.upsertByOriginalUrl({
      url: 'https://example.com/new',
      sourceName: 'NYT',
      sourceFeedUrl: 'https://example.com/feed.xml',
      title:
        'Scientists discover new particle that changes our understanding of physics',
      description: 'desc',
      publishedAt: new Date(),
    });

    expect(res).toEqual({ created: true, articleId: 'created-1' });
    expect(prisma.article.create).toHaveBeenCalledTimes(1);
  });

  it('does not run near-duplicate detection when originalUrl already exists', async () => {
    const prisma = makePrismaMock();
    prisma.article.findUnique.mockResolvedValueOnce({ id: 'existing-url' });

    const repo = new PrismaArticleRepository(
      prisma as unknown as PrismaService,
    );
    const res = await repo.upsertByOriginalUrl({
      url: 'https://example.com/existing',
      sourceName: 'Guardian',
      sourceFeedUrl: 'https://example.com/feed.xml',
      title: 'Anything',
      description: 'desc',
      publishedAt: new Date(),
    });

    expect(res).toEqual({ created: false, articleId: 'existing-url' });
    expect(prisma.source.upsert).not.toHaveBeenCalled();
    expect(prisma.article.findMany).not.toHaveBeenCalled();
    expect(prisma.article.create).not.toHaveBeenCalled();
  });
});
