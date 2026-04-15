import type { RawFeedItem } from '../entities/raw-feed-item.entity';

export type UpsertArticleInput = RawFeedItem & {
  sourceName: string;
  sourceFeedUrl: string;
};

export interface ArticleRepositoryPort {
  /**
   * Insert article if not present. Return true if created.
   * (In DB-backed implementations this should be protected by a unique constraint.)
   */
  upsertByOriginalUrl(
    item: UpsertArticleInput,
  ): Promise<{ created: boolean; articleId: string }>;
}
