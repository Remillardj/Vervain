export interface ManagedStoragePolicy {
  protectedDomains?: string[];
  trustedContacts?: Array<{ name: string; email: string }>;
  configUrl?: string;
  configAuthToken?: string;
  configRefreshIntervalMinutes?: number;
  aiProvider?: 'anthropic' | 'openai';
  aiApiKey?: string;
  aiModel?: string;
  aiAutoScan?: boolean;
  tiAutoScan?: boolean;
  virusTotalApiKey?: string;
  enabledThreatFeeds?: string[];
  domainDetectionEnabled?: boolean;
  contactDetectionEnabled?: boolean;
}

export interface LocalSettings {
  setupComplete?: boolean;
  domainDetectionEnabled?: boolean;
  contactDetectionEnabled?: boolean;
  autoTI?: boolean;
  autoAI?: boolean;
  aiProvider?: 'anthropic' | 'openai';
  aiApiKey?: string;
  aiModel?: string;
  aiEnabled?: boolean;
  virusTotalApiKey?: string;
  enabledThreatFeeds?: string[];
  primaryDomain?: string;
  alertsCount?: number;
  lastUpdated?: number;
}

export interface MergedConfig {
  domainDetectionEnabled: boolean;
  contactDetectionEnabled: boolean;
  autoTI: boolean;
  autoAI: boolean;
  aiProvider: 'anthropic' | 'openai';
  aiApiKey: string;
  aiModel: string;
  aiEnabled: boolean;
  virusTotalApiKey: string;
  enabledThreatFeeds: string[];
  primaryDomain: string;
  managedDomains: string[];
  managedContacts: Array<{ name: string; email: string }>;
  configUrl: string;
  configAuthToken: string;
  configRefreshIntervalMinutes: number;
  lockedKeys: string[];
}

const DEFAULTS: Omit<MergedConfig, 'lockedKeys' | 'managedDomains' | 'managedContacts'> = {
  domainDetectionEnabled: true,
  contactDetectionEnabled: true,
  autoTI: false,
  autoAI: false,
  aiProvider: 'anthropic',
  aiApiKey: '',
  aiModel: 'claude-sonnet-4-5-20250929',
  aiEnabled: false,
  virusTotalApiKey: '',
  enabledThreatFeeds: ['phishtank', 'urlhaus', 'threatfox', 'openphish'],
  primaryDomain: '',
  configUrl: '',
  configAuthToken: '',
  configRefreshIntervalMinutes: 60,
};

// Maps managed policy keys to merged config keys
const MANAGED_TO_CONFIG: Record<string, string> = {
  aiAutoScan: 'autoAI',
  tiAutoScan: 'autoTI',
};

export class ConfigManager {
  merge(managed: Partial<ManagedStoragePolicy>, local: Partial<LocalSettings>): MergedConfig {
    const lockedKeys: string[] = [];
    const result = { ...DEFAULTS } as MergedConfig & Record<string, unknown>;

    // Apply local settings over defaults
    for (const [key, value] of Object.entries(local)) {
      if (value !== undefined && key in result) {
        result[key] = value;
      }
    }

    // Map local autoTI/autoAI
    if (local.autoTI !== undefined) result.autoTI = local.autoTI;
    if (local.autoAI !== undefined) result.autoAI = local.autoAI;

    // Apply managed settings over local (managed wins)
    for (const [key, value] of Object.entries(managed)) {
      if (value === undefined) continue;

      const configKey = MANAGED_TO_CONFIG[key] || key;

      if (configKey in result && configKey !== 'protectedDomains' && configKey !== 'trustedContacts') {
        result[configKey] = value;
        lockedKeys.push(configKey);
      }
    }

    // Managed domain/contact lists
    result.managedDomains = managed.protectedDomains ?? [];
    result.managedContacts = managed.trustedContacts ?? [];
    if (managed.protectedDomains) lockedKeys.push('managedDomains');
    if (managed.trustedContacts) lockedKeys.push('managedContacts');

    result.lockedKeys = lockedKeys;
    return result as MergedConfig;
  }
}
