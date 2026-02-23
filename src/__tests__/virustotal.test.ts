import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { VirusTotalClient } from '@/background/feeds/virustotal';
import { VervainDB } from '@/background/db';

describe('VirusTotalClient', () => {
  let db: VervainDB;

  beforeEach(async () => {
    if (db) db.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('vervain_db');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db = new VervainDB();
    await db.open();
  });

  it('returns cached result if not expired', async () => {
    const now = Date.now();
    await db.setVTCache({
      domain: 'test.com',
      reputation: 5,
      domainAge: '2020-01-01',
      detectionRatio: '2/70',
      rawResponse: {},
      fetchedAt: now,
      expiresAt: now + 86400000,
    });

    const client = new VirusTotalClient('test-key', db);
    const report = await client.lookupDomain('test.com');
    expect(report).toBeTruthy();
    expect(report!.reputation).toBe(5);
  });
});
