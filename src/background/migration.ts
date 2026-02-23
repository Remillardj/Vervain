import { VervainDB } from './db';

/**
 * Migrate existing chrome.storage.local domain/contact lists to IndexedDB.
 * Called on extension install or update. Idempotent.
 */
export async function migrateToIndexedDB(db: VervainDB): Promise<void> {
  const data = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get([
      'primaryDomain', 'additionalDomains', 'trustedContacts', 'migrationComplete'
    ], resolve);
  });

  if (data.migrationComplete) return; // Already migrated

  // Migrate primary domain
  if (data.primaryDomain && typeof data.primaryDomain === 'string') {
    const domain = data.primaryDomain as string;
    const parts = domain.split('.');
    const baseName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    try {
      await db.addDomain({ domain, baseName, source: 'local' });
    } catch { /* duplicate, ignore */ }
  }

  // Migrate additional domains
  if (Array.isArray(data.additionalDomains)) {
    for (const domain of data.additionalDomains) {
      if (typeof domain !== 'string') continue;
      const parts = domain.split('.');
      const baseName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      try {
        await db.addDomain({ domain, baseName, source: 'local' });
      } catch { /* duplicate, ignore */ }
    }
  }

  // Migrate trusted contacts
  if (Array.isArray(data.trustedContacts)) {
    for (const contact of data.trustedContacts) {
      if (!contact?.name || !contact?.email) continue;
      const contactDomain = contact.email.split('@')[1] || '';
      try {
        await db.addContact({ name: contact.name, email: contact.email, domain: contactDomain, source: 'local' });
      } catch { /* duplicate, ignore */ }
    }
  }

  // Mark migration complete
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ migrationComplete: true }, resolve);
  });
}
