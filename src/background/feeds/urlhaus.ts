import { FeedSource, FeedEntry } from './types';

export class URLhausFeed implements FeedSource {
  readonly id = 'urlhaus';
  readonly name = 'URLhaus';
  readonly refreshIntervalMs = 30 * 60 * 1000; // 30 minutes

  async fetch(): Promise<FeedEntry[]> {
    const response = await globalThis.fetch(
      'https://urlhaus.abuse.ch/downloads/csv_recent/',
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(`URLhaus fetch failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parse(text);
  }

  private parse(csv: string): FeedEntry[] {
    const entries: FeedEntry[] = [];
    const lines = csv.split('\n');

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) continue;

      try {
        // CSV: id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
        const parts = line.split(',');
        if (parts.length < 3) continue;
        const url = parts[2]?.replace(/"/g, '').trim();
        if (url && url.startsWith('http')) {
          const domain = this.extractDomain(url);
          if (domain) {
            entries.push({ domain, url, metadata: { source: 'urlhaus', threat: parts[5]?.replace(/"/g, '') } });
          }
        }
      } catch { /* skip malformed lines */ }
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
