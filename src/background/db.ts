export interface DomainRecord {
  id?: number;
  domain: string;
  baseName: string;
  source: 'managed' | 'local' | 'configUrl';
  addedAt?: number;
}

export interface ContactRecord {
  id?: number;
  name: string;
  email: string;
  domain: string;
  source: 'managed' | 'local' | 'configUrl';
  addedAt?: number;
}

export interface FeedCacheRecord {
  feedId: string;
  domain: string;
  feedData: Record<string, unknown>;
  fetchedAt?: number;
  expiresAt: number;
}

export interface VTCacheRecord {
  domain: string;
  reputation: number;
  domainAge: string;
  detectionRatio: string;
  rawResponse: Record<string, unknown>;
  fetchedAt: number;
  expiresAt: number;
}

export interface ScanResultRecord {
  id?: number;
  emailId: string;
  sender: string;
  domain: string;
  verdict: 'clean' | 'warning' | 'suspicious';
  detections: Array<{ rule: string; evidence: string }>;
  tiResults: Record<string, unknown> | null;
  aiResults: Record<string, unknown> | null;
  scannedAt: number;
}

const DB_NAME = 'vervain_db';
const DB_VERSION = 1;

export class VervainDB {
  private db: IDBDatabase | null = null;

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // domains
        if (!db.objectStoreNames.contains('domains')) {
          const store = db.createObjectStore('domains', { keyPath: 'id', autoIncrement: true });
          store.createIndex('domain', 'domain', { unique: true });
          store.createIndex('baseName', 'baseName', { unique: false });
          store.createIndex('source', 'source', { unique: false });
        }

        // contacts
        if (!db.objectStoreNames.contains('contacts')) {
          const store = db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('email', 'email', { unique: true });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('source', 'source', { unique: false });
        }

        // threatFeedCache
        if (!db.objectStoreNames.contains('threatFeedCache')) {
          const store = db.createObjectStore('threatFeedCache', { keyPath: ['feedId', 'domain'] });
          store.createIndex('feedId', 'feedId', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // vtCache
        if (!db.objectStoreNames.contains('vtCache')) {
          db.createObjectStore('vtCache', { keyPath: 'domain' });
        }

        // scanResults
        if (!db.objectStoreNames.contains('scanResults')) {
          const store = db.createObjectStore('scanResults', { keyPath: 'id', autoIncrement: true });
          store.createIndex('emailId', 'emailId', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('scannedAt', 'scannedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private getStore(name: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not open');
    return this.db.transaction(name, mode).objectStore(name);
  }

  // --- Domains ---

  addDomain(record: Omit<DomainRecord, 'id'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('domains', 'readwrite');
      const req = store.add({ ...record, addedAt: record.addedAt ?? Date.now() });
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  getAllDomains(): Promise<DomainRecord[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('domains');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  deleteLocalDomain(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('domains', 'readwrite');
      const index = store.index('domain');
      const req = index.getKey(domain);
      req.onsuccess = () => {
        if (req.result != null) {
          // Verify it's a local domain before deleting
          const getReq = store.get(req.result);
          getReq.onsuccess = () => {
            if (getReq.result && getReq.result.source === 'local') {
              const delReq = store.delete(req.result);
              delReq.onsuccess = () => resolve();
              delReq.onerror = () => reject(delReq.error);
            } else {
              resolve(); // Don't delete managed domains
            }
          };
          getReq.onerror = () => reject(getReq.error);
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  clearDomainsBySource(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('domains', 'readwrite');
      const index = store.index('source');
      const req = index.openCursor(IDBKeyRange.only(source));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Contacts ---

  addContact(record: Omit<ContactRecord, 'id'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('contacts', 'readwrite');
      const req = store.add({ ...record, addedAt: record.addedAt ?? Date.now() });
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  getAllContacts(): Promise<ContactRecord[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('contacts');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Threat Feed Cache ---

  bulkInsertFeedDomains(
    feedId: string,
    entries: Array<{ domain: string; feedData: Record<string, unknown>; expiresAt: number }>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) { reject(new Error('Database not open')); return; }
      const tx = this.db.transaction('threatFeedCache', 'readwrite');
      const store = tx.objectStore('threatFeedCache');
      const now = Date.now();
      for (const entry of entries) {
        store.put({ feedId, domain: entry.domain, feedData: entry.feedData, fetchedAt: now, expiresAt: entry.expiresAt });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  getFeedDomain(feedId: string, domain: string): Promise<FeedCacheRecord | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('threatFeedCache');
      const req = store.get([feedId, domain]);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  getAllFeedDomains(feedId: string): Promise<FeedCacheRecord[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('threatFeedCache');
      const index = store.index('feedId');
      const req = index.getAll(IDBKeyRange.only(feedId));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- VT Cache ---

  getVTCache(domain: string): Promise<VTCacheRecord | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('vtCache');
      const req = store.get(domain);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  setVTCache(record: VTCacheRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('vtCache', 'readwrite');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Scan Results ---

  addScanResult(record: Omit<ScanResultRecord, 'id'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('scanResults', 'readwrite');
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
