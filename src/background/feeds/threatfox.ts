import { FeedSource, FeedEntry } from './types';

export class ThreatFoxFeed implements FeedSource {
  readonly id = 'threatfox';
  readonly name = 'ThreatFox';
  readonly refreshIntervalMs = 60 * 60 * 1000; // 1 hour

  async fetch(): Promise<FeedEntry[]> {
    const response = await globalThis.fetch(
      'https://threatfox-api.abuse.ch/api/v1/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'get_iocs', days: 1 }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      throw new Error(`ThreatFox fetch failed: ${response.status}`);
    }

    const data = await response.json();
    return this.parse(data);
  }

  private parse(data: Record<string, unknown>): FeedEntry[] {
    const entries: FeedEntry[] = [];
    const iocs = (data.data as Array<Record<string, unknown>>) ?? [];

    for (const ioc of iocs) {
      const iocType = ioc.ioc_type as string;
      const iocValue = ioc.ioc as string;

      if (!iocValue) continue;

      // Extract domain from URL or domain IOC types
      if (iocType === 'domain' || iocType === 'url') {
        const domain = iocType === 'url' ? this.extractDomain(iocValue) : iocValue.toLowerCase();
        if (domain) {
          entries.push({ domain, metadata: { source: 'threatfox', malware: ioc.malware, threat_type: ioc.threat_type } });
        }
      }
    }

    return entries;
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      // If not a valid URL, try treating it as a bare domain
      const cleaned = url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      return cleaned || null;
    }
  }
}
