import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '@/background/configManager';

describe('ConfigManager', () => {
  let cm: ConfigManager;

  beforeEach(() => {
    cm = new ConfigManager();
  });

  it('returns defaults when no managed or local config exists', () => {
    const merged = cm.merge({}, {});
    expect(merged.domainDetectionEnabled).toBe(true);
    expect(merged.contactDetectionEnabled).toBe(true);
    expect(merged.autoTI).toBe(false);
    expect(merged.autoAI).toBe(false);
  });

  it('local settings override defaults', () => {
    const merged = cm.merge({}, { autoTI: true });
    expect(merged.autoTI).toBe(true);
  });

  it('managed settings override local settings', () => {
    const merged = cm.merge(
      { domainDetectionEnabled: false },
      { domainDetectionEnabled: true }
    );
    expect(merged.domainDetectionEnabled).toBe(false);
  });

  it('tracks which keys are managed (locked)', () => {
    const merged = cm.merge(
      { aiProvider: 'openai', aiApiKey: 'org-key' },
      { aiProvider: 'anthropic' }
    );
    expect(merged.aiProvider).toBe('openai');
    expect(merged.lockedKeys).toContain('aiProvider');
    expect(merged.lockedKeys).toContain('aiApiKey');
  });

  it('merges domain lists (managed + local)', () => {
    const merged = cm.merge(
      { protectedDomains: ['corp.com'] },
      {}
    );
    expect(merged.managedDomains).toEqual(['corp.com']);
  });
});
