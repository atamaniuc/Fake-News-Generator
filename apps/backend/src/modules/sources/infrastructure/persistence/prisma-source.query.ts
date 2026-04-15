import { Injectable } from '@nestjs/common';
import type { SourcesSummary } from '@fakenews/shared';
import { PrismaService } from '../../../../shared/database/prisma.service';
import type { SourceQueryPort } from '../../domain/ports/source.query.port';

@Injectable()
export class PrismaSourceQuery implements SourceQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<SourcesSummary> {
    const [sources, grouped, total] = await Promise.all([
      this.prisma.source.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.article.groupBy({
        by: ['sourceId'],
        where: { status: 'DONE' },
        _count: { _all: true },
      }),
      this.prisma.article.count({ where: { status: 'DONE' } }),
    ]);

    const countBySourceId = new Map<string, number>();
    for (const g of grouped) {
      countBySourceId.set(g.sourceId, g._count._all);
    }

    return {
      total,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        count: countBySourceId.get(s.id) ?? 0,
      })),
    };
  }
}
