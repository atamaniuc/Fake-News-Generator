import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { FEED_SOURCES } from '../../../scraper/application/constants/feed-sources';

@Injectable()
export class SourcesSeeder implements OnModuleInit {
  private readonly logger = new Logger(SourcesSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Ensure default sources exist even on a fresh/emptied database, so the UI filter is populated.
    for (const s of FEED_SOURCES) {
      await this.prisma.source.upsert({
        where: { feedUrl: s.feedUrl },
        update: { name: s.name },
        create: { name: s.name, feedUrl: s.feedUrl },
        select: { id: true },
      });
    }
    this.logger.log(`Seeded ${FEED_SOURCES.length} sources`);
  }
}
