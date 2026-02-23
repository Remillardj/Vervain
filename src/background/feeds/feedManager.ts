import { FeedSource } from './types';
import { VervainDB } from '../db';
import { BloomFilter } from '../detection/bloomFilter';

export class FeedManager {
  private sources: Map<string, FeedSource> = new Map();
  private db: VervainDB;
  private bloomFilter: BloomFilter;
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(db: VervainDB) {
    this.db = db;
    this.bloomFilter = new BloomFilter(100000, 0.001);
  }

  registerSource(source: FeedSource): void {
    this.sources.set(source.id, source);
  }

  async refreshSource(sourceId: string): Promise<number> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Unknown feed source: ${sourceId}`);

    const entries = await source.fetch();
    const expiresAt = Date.now() + source.refreshIntervalMs * 2;

    await this.db.bulkInsertFeedDomains(
      sourceId,
      entries.map(e => ({ domain: e.domain, feedData: e.metadata ?? {}, expiresAt }))
    );

    // Add to bloom filter
    for (const entry of entries) {
      this.bloomFilter.add(entry.domain.toLowerCase());
    }

    return entries.length;
  }

  async rebuildBloomFilter(): Promise<void> {
    this.bloomFilter = new BloomFilter(100000, 0.001);
    for (const [sourceId] of this.sources) {
      const entries = await this.db.getAllFeedDomains(sourceId);
      for (const entry of entries) {
        if (entry.expiresAt > Date.now()) {
          this.bloomFilter.add(entry.domain.toLowerCase());
        }
      }
    }
  }

  getBloomFilter(): BloomFilter {
    return this.bloomFilter;
  }

  startScheduledRefresh(enabledFeeds: string[]): void {
    this.stopAll();
    for (const sourceId of enabledFeeds) {
      const source = this.sources.get(sourceId);
      if (!source) continue;
      // Initial fetch
      this.refreshSource(sourceId).catch(err => console.error(`[Vervain] Feed ${sourceId} refresh error:`, err));
      // Scheduled refresh
      const timer = setInterval(() => {
        this.refreshSource(sourceId).catch(err => console.error(`[Vervain] Feed ${sourceId} refresh error:`, err));
      }, source.refreshIntervalMs);
      this.timers.set(sourceId, timer);
    }
  }

  stopAll(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }
}
