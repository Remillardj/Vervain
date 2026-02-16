// Chrome storage utility for phishing guard

export interface TrustedContact {
  name: string;
  email: string;
}

export interface UserDomainData {
  setupComplete?: boolean;
  detectionEnabled?: boolean; // Legacy - kept for migration
  domainDetectionEnabled?: boolean; // Monitor for domain spoofing
  contactDetectionEnabled?: boolean; // Monitor for contact impersonation
  primaryDomain?: string;
  variations?: Array<{ domain: string; type: string }>;
  whitelistedDomains?: string[];
  blockedDomains?: string[];
  additionalDomains?: string[];
  trustedContacts?: TrustedContact[];
  autoAddDomains?: boolean; // New configuration option for auto-adding domains
  alertsCount?: number; // Number of alerts shown
  lastUpdated?: number; // Timestamp of last update
  aiProvider?: 'anthropic' | 'openai';
  aiApiKey?: string;
  aiModel?: string;
  aiEnabled?: boolean;
}

// Default data
const defaultData: UserDomainData = {
  primaryDomain: '',
  variations: [],
  setupComplete: false,
  detectionEnabled: true, // Legacy - for migration
  domainDetectionEnabled: true,
  contactDetectionEnabled: true,
  alertsCount: 0,
  blockedDomains: [],
  whitelistedDomains: [],
  lastUpdated: 0,
  additionalDomains: [],
  trustedContacts: [],
  aiProvider: 'anthropic',
  aiApiKey: '',
  aiModel: 'claude-sonnet-4-5-20250929',
  aiEnabled: false
};

// Save data to Chrome storage
export const saveData = async (data: Partial<UserDomainData>): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } else {
      // Handle case where chrome API is not available (development environment)
      console.warn('Chrome storage API not available, using localStorage instead');
      try {
        // Save to localStorage as fallback
        const currentData = localStorage.getItem('vervain-data');
        const parsedData = currentData ? JSON.parse(currentData) : defaultData;
        localStorage.setItem('vervain-data', JSON.stringify({...parsedData, ...data}));
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
};

// Get all data from Chrome storage
export const getData = async (): Promise<UserDomainData> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(Object.keys(defaultData), (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({...defaultData, ...result} as UserDomainData);
        }
      });
    } else {
      // Handle case where chrome API is not available (development environment)
      console.warn('Chrome storage API not available, using localStorage instead');
      try {
        // Get from localStorage as fallback
        const data = localStorage.getItem('vervain-data');
        resolve(data ? {...defaultData, ...JSON.parse(data)} : defaultData);
      } catch (error) {
        reject(error);
      }
    }
  });
};

// Save primary domain and generate variations
export async function savePrimaryDomain(domain: string, variations: any[]) {
  return new Promise<void>((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        primaryDomain: domain,
        variations,
        setupComplete: true,
        lastUpdated: Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } else {
      // Fallback for development
      try {
        const data = localStorage.getItem('vervain-data');
        const parsedData = data ? JSON.parse(data) : defaultData;
        localStorage.setItem('vervain-data', JSON.stringify({
          ...parsedData,
          primaryDomain: domain,
          variations,
          setupComplete: true,
          lastUpdated: Date.now()
        }));
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

// Add a domain to blocklist
export const blockDomain = async (domain: string): Promise<void> => {
  const data = await getData();
  if (!data.blockedDomains.includes(domain)) {
    await saveData({
      blockedDomains: [...data.blockedDomains, domain]
    });
  }
};

// Add a domain to whitelist
export const whitelistDomain = async (domain: string): Promise<void> => {
  const data = await getData();
  if (!data.whitelistedDomains.includes(domain)) {
    await saveData({
      whitelistedDomains: [...data.whitelistedDomains, domain]
    });
  }
};

// Remove a domain from blocklist
export const unblockDomain = async (domain: string): Promise<void> => {
  const data = await getData();
  await saveData({
    blockedDomains: data.blockedDomains.filter(d => d !== domain)
  });
};

// Remove a domain from whitelist
export const unwhitelistDomain = async (domain: string): Promise<void> => {
  const data = await getData();
  await saveData({
    whitelistedDomains: data.whitelistedDomains.filter(d => d !== domain)
  });
};

// Increment alerts count
export const incrementAlertsCount = async (): Promise<void> => {
  const data = await getData();
  await saveData({
    alertsCount: data.alertsCount + 1
  });
};

// Enable/disable detection (legacy - kept for backward compatibility)
export async function setDetectionEnabled(enabled: boolean) {
  return saveData({
    detectionEnabled: enabled,
    domainDetectionEnabled: enabled,
    contactDetectionEnabled: enabled
  });
}

// Enable/disable domain detection
export async function setDomainDetectionEnabled(enabled: boolean) {
  return saveData({ domainDetectionEnabled: enabled });
}

// Enable/disable contact detection
export async function setContactDetectionEnabled(enabled: boolean) {
  return saveData({ contactDetectionEnabled: enabled });
}

// Save additional domains
export async function saveAdditionalDomains(domains: string[]) {
  return saveData({ 
    additionalDomains: domains,
    lastUpdated: Date.now() 
  });
}

// Add a single additional domain
export async function addAdditionalDomain(domain: string): Promise<void> {
  const data = await getData();
  if (!data.additionalDomains.includes(domain)) {
    await saveData({
      additionalDomains: [...data.additionalDomains, domain],
      lastUpdated: Date.now()
    });
  }
}

// Remove a single additional domain
export async function removeAdditionalDomain(domain: string): Promise<void> {
  const data = await getData();
  await saveData({
    additionalDomains: data.additionalDomains.filter(d => d !== domain),
    lastUpdated: Date.now()
  });
}

// Add a trusted contact
export async function addTrustedContact(contact: TrustedContact): Promise<void> {
  const data = await getData();
  // Check if contact already exists (by email)
  const exists = data.trustedContacts.some(c => c.email.toLowerCase() === contact.email.toLowerCase());
  if (!exists) {
    await saveData({
      trustedContacts: [...data.trustedContacts, contact],
      lastUpdated: Date.now()
    });
  }
}

// Update a trusted contact
export async function updateTrustedContact(oldEmail: string, contact: TrustedContact): Promise<void> {
  const data = await getData();
  const updatedContacts = data.trustedContacts.map(c => 
    c.email.toLowerCase() === oldEmail.toLowerCase() ? contact : c
  );
  await saveData({
    trustedContacts: updatedContacts,
    lastUpdated: Date.now()
  });
}

// Remove a trusted contact
export async function removeTrustedContact(email: string): Promise<void> {
  const data = await getData();
  await saveData({
    trustedContacts: data.trustedContacts.filter(c => c.email.toLowerCase() !== email.toLowerCase()),
    lastUpdated: Date.now()
  });
}

// Save all trusted contacts
export async function saveTrustedContacts(contacts: TrustedContact[]): Promise<void> {
  await saveData({
    trustedContacts: contacts,
    lastUpdated: Date.now()
  });
}
