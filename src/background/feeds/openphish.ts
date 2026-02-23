import { FeedSource, FeedEntry } from './types';

export class OpenPhishFeed implements FeedSource {
  readonly id = 'openphish';
  readonly name = 'OpenPhish';
  readonly refreshIntervalMs = 12 * 60 * 60 * 1000; // 12 hours

  async fetch(): Promise<FeedEntry[]> {
    const response = await globalThis.fetch(
      'https://openphish.com/feed.txt',
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(`OpenPhish fetch failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parse(text);
  }

  private parse(text: string): FeedEntry[] {
    const entries: FeedEntry[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const url = line.trim();
      if (!url || !url.startsWith('http')) continue;

      const domain = this.extractDomain(url);
      if (domain) {
        entries.push({ domain, url, metadata: { source: 'openphish' } });
      }
    }

    return entries;
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}
