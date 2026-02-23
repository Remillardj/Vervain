import { FeedSource, FeedEntry } from './types';

export class PhishTankFeed implements FeedSource {
  readonly id = 'phishtank';
  readonly name = 'PhishTank';
  readonly refreshIntervalMs = 60 * 60 * 1000; // 1 hour

  async fetch(): Promise<FeedEntry[]> {
    const response = await globalThis.fetch(
      'https://data.phishtank.com/data/online-valid.csv',
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(`PhishTank fetch failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parse(text);
  }

  private parse(csv: string): FeedEntry[] {
    const entries: FeedEntry[] = [];
    const lines = csv.split('\n');

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // CSV format: phish_id,url,phish_detail_url,submission_time,verified,verification_time,online,target
        const urlMatch = line.match(/,([^,]*https?:\/\/[^,]*),/);
        if (urlMatch) {
          const domain = this.extractDomain(urlMatch[1].replace(/"/g, ''));
          if (domain) {
            entries.push({ domain, url: urlMatch[1], metadata: { source: 'phishtank' } });
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
