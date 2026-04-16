import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import type { RawFeedItem } from '../../domain/entities/raw-feed-item.entity';
import type { RssFetcherPort } from '../../domain/ports/rss-fetcher.port';

// TODO: Move helpers to a separate lib.

function toText(v: unknown): string {
  if (Array.isArray(v)) return toText(v[0]);
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toDate(v: unknown): Date {
  const s = toText(v);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function extractHref(v: unknown): string {
  if (!isRecord(v)) return '';
  const attr = v.$;
  if (isRecord(attr) && typeof attr.href === 'string') return attr.href;
  if (typeof v.href === 'string') return v.href;
  return '';
}

function extractUrl(it: unknown): string {
  // RSS: <link>https://...</link>
  // Atom: <link href="https://..." />
  const link = isRecord(it) ? it.link : undefined;
  if (Array.isArray(link)) {
    for (const l of link) {
      if (typeof l === 'string') return l;
      const href = extractHref(l);
      if (href) return href;
    }
  } else if (typeof link === 'string') {
    return link;
  } else {
    const href = extractHref(link);
    if (href) return href;
  }
  return isRecord(it) ? toText(it.guid) : '';
}

/**
 * Adapts RSS/Atom feed fetching using the Axios library, implementing the `RssFetcherPort` interface.
 * This allows the retrieval of RSS or Atom feed items from a given feed URL.
 */
@Injectable()
export class AxiosRssFetcherAdapter implements RssFetcherPort {
  async fetch(feedUrl: string): Promise<RawFeedItem[]> {
    const res = await axios.get(feedUrl, {
      timeout: 15_000,
      headers: { 'User-Agent': 'fake-news-generator/0.0.1' },
    });

    const xml = String(res.data ?? '');
    const parsed: unknown = await parseStringPromise(xml, {
      explicitArray: true,
      trim: true,
    });

    const rss = isRecord(parsed) ? parsed.rss : undefined;
    const channel = isRecord(rss) ? rss.channel : undefined;
    const channel0 = isArray(channel) ? channel[0] : undefined;
    const rssItems = isRecord(channel0) ? channel0.item : undefined;

    const feed = isRecord(parsed) ? parsed.feed : undefined;
    const atomItems = isRecord(feed) ? feed.entry : undefined;

    const items: unknown[] =
      (Array.isArray(rssItems) ? rssItems : null) ??
      (Array.isArray(atomItems) ? atomItems : []);

    return items
      .map((it) => {
        const title = isRecord(it) ? toText(it.title) : '';
        const description = toText(
          isRecord(it)
            ? (it.description ?? it.summary ?? it['content:encoded'] ?? '')
            : '',
        );
        const url = extractUrl(it);
        const publishedAt = toDate(
          isRecord(it) ? (it.pubDate ?? it.published ?? it.updated) : '',
        );
        if (!title || !url) return null;
        return { title, description, url, publishedAt } satisfies RawFeedItem;
      })
      .filter(Boolean) as RawFeedItem[];
  }
}
