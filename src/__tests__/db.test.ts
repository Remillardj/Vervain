import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { VervainDB } from '@/background/db';

describe('VervainDB', () => {
  let db: VervainDB;

  beforeEach(async () => {
    // Close any existing DB connection before deleting
    if (db) db.close();
    // Await the delete request to avoid blocking
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('vervain_db');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db = new VervainDB();
    await db.open();
  });

  describe('domains', () => {
    it('adds and retrieves a domain', async () => {
      await db.addDomain({ domain: 'google.com', baseName: 'google', source: 'local' });
      const domains = await db.getAllDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('google.com');
      expect(domains[0].baseName).toBe('google');
    });

    it('prevents duplicate domains', async () => {
      await db.addDomain({ domain: 'google.com', baseName: 'google', source: 'local' });
      await expect(db.addDomain({ domain: 'google.com', baseName: 'google', source: 'local' }))
        .rejects.toThrow();
    });

    it('deletes local domains but not managed', async () => {
      await db.addDomain({ domain: 'local.com', baseName: 'local', source: 'local' });
      await db.addDomain({ domain: 'managed.com', baseName: 'managed', source: 'managed' });
      await db.deleteLocalDomain('local.com');
      const domains = await db.getAllDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('managed.com');
    });
  });

  describe('contacts', () => {
    it('adds and retrieves a contact', async () => {
      await db.addContact({ name: 'Alice', email: 'alice@example.com', domain: 'example.com', source: 'local' });
      const contacts = await db.getAllContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Alice');
    });
  });

  describe('threatFeedCache', () => {
    it('bulk inserts and queries feed domains', async () => {
      await db.bulkInsertFeedDomains('phishtank', [
        { domain: 'evil.com', feedData: {}, expiresAt: Date.now() + 86400000 },
        { domain: 'bad.org', feedData: {}, expiresAt: Date.now() + 86400000 },
      ]);
      const entry = await db.getFeedDomain('phishtank', 'evil.com');
      expect(entry).toBeTruthy();
      expect(entry!.domain).toBe('evil.com');
    });
  });
});
