export const FEED_SOURCES = [
  {
    name: 'NYT',
    feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  },
  {
    name: 'NPR',
    feedUrl: 'https://feeds.npr.org/1001/rss.xml',
  },
  {
    name: 'Guardian',
    feedUrl: 'https://www.theguardian.com/world/rss',
  },
] as const;
