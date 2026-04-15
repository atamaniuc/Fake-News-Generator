import type { RawFeedItem } from '../entities/raw-feed-item.entity';

export interface RssFetcherPort {
  fetch(feedUrl: string): Promise<RawFeedItem[]>;
}
