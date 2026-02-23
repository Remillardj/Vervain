import { describe, it, expect, beforeEach } from 'vitest';
import { DetectionEngine } from '@/background/detection/engine';

describe('DetectionEngine', () => {
  let engine: DetectionEngine;

  beforeEach(() => {
    engine = new DetectionEngine();
    engine.rebuild({
      domains: [
        { domain: 'google.com', baseName: 'google' },
        { domain: 'microsoft.com', baseName: 'microsoft' },
        { domain: 'monarch.com', baseName: 'monarch' },
      ],
      contacts: [
        { name: 'Alice Smith', email: 'alice@google.com' },
      ],
      threatDomains: ['evil-phish.com', 'badsite.org'],
    });
  });

  it('returns clean for trusted domain', () => {
    const result = engine.passiveScan({ sender: 'user@google.com', domain: 'google.com', contactName: 'User' });
    expect(result.verdict).toBe('clean');
  });

  it('detects typosquatting via BK-tree', () => {
    const result = engine.passiveScan({ sender: 'user@go0gle.com', domain: 'go0gle.com', contactName: '' });
    expect(result.verdict).not.toBe('clean');
    expect(result.rule).toContain('homograph');
  });

  it('detects brand embedding', () => {
    const result = engine.passiveScan({ sender: 'a@customer-support-google.com', domain: 'customer-support-google.com', contactName: '' });
    expect(result.verdict).not.toBe('clean');
    expect(result.rule).toContain('brand');
  });

  it('detects known-bad domain via bloom filter', () => {
    const result = engine.passiveScan({ sender: 'a@evil-phish.com', domain: 'evil-phish.com', contactName: '' });
    expect(result.verdict).not.toBe('clean');
    expect(result.rule).toContain('threat-feed');
  });

  it('detects contact name spoofing', () => {
    const result = engine.passiveScan({ sender: 'alice@evil.com', domain: 'evil.com', contactName: 'Alice Smith' });
    expect(result.verdict).not.toBe('clean');
    expect(result.rule).toContain('contact-spoof');
  });

  it('does not flag contact with matching email', () => {
    const result = engine.passiveScan({ sender: 'alice@google.com', domain: 'google.com', contactName: 'Alice Smith' });
    expect(result.verdict).toBe('clean');
  });
});
