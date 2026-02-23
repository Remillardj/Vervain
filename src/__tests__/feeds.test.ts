import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { FeedManager } from '@/background/feeds/feedManager';
import { VervainDB } from '@/background/db';
import { FeedSource, FeedEntry } from '@/background/feeds/types';

class MockFeedSource implements FeedSource {
  readonly id = 'mock';
  readonly name = 'Mock Feed';
  readonly refreshIntervalMs = 60000;
  private entries: FeedEntry[];

  constructor(entries: FeedEntry[]) {
    this.entries = entries;
  }

  async fetch(): Promise<FeedEntry[]> {
    return this.entries;
  }
}

describe('FeedManager', () => {
  let db: VervainDB;
  let manager: FeedManager;

  beforeEach(async () => {
    if (db) db.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('vervain_db');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db = new VervainDB();
    await db.open();
    manager = new FeedManager(db);
  });

  it('refreshes a source and updates bloom filter', async () => {
    const source = new MockFeedSource([
      { domain: 'evil.com' },
      { domain: 'phishing.org' },
    ]);
    manager.registerSource(source);

    const count = await manager.refreshSource('mock');
    expect(count).toBe(2);

    const bf = manager.getBloomFilter();
    expect(bf.has('evil.com')).toBe(true);
    expect(bf.has('phishing.org')).toBe(true);
    expect(bf.has('safe.com')).toBe(false);
  });

  it('rebuilds bloom filter from DB', async () => {
    const source = new MockFeedSource([{ domain: 'cached.com' }]);
    manager.registerSource(source);
    await manager.refreshSource('mock');

    // Create new manager and rebuild from DB
    const manager2 = new FeedManager(db);
    manager2.registerSource(source);
    await manager2.rebuildBloomFilter();
    expect(manager2.getBloomFilter().has('cached.com')).toBe(true);
  });
});
