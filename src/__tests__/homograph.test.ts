import { describe, it, expect } from 'vitest';
import { normalizeHomographs, buildNormalizedMap } from '@/background/detection/homograph';

describe('normalizeHomographs', () => {
  it('normalizes Cyrillic o to Latin o', () => {
    // Cyrillic 'о' (U+043E) → 'o'
    expect(normalizeHomographs('g\u043E\u043Egle')).toBe('google');
  });

  it('normalizes number substitutions', () => {
    expect(normalizeHomographs('g00gle')).toBe('google');
    expect(normalizeHomographs('m1cr0soft')).toBe('microsoft');
  });

  it('normalizes rn → m', () => {
    expect(normalizeHomographs('payrnent')).toBe('payment');
  });

  it('normalizes cl → d', () => {
    expect(normalizeHomographs('acl0be')).toBe('adobe');
  });

  it('leaves clean strings unchanged', () => {
    expect(normalizeHomographs('google')).toBe('google');
  });
});

describe('buildNormalizedMap', () => {
  it('maps normalized forms to original domains', () => {
    const map = buildNormalizedMap(['google.com', 'microsoft.com']);
    expect(map.get('google')).toBe('google.com');
    expect(map.get('microsoft')).toBe('microsoft.com');
  });

  it('detects homograph via normalized lookup', () => {
    const map = buildNormalizedMap(['google.com']);
    const senderBase = normalizeHomographs('g00gle');
    expect(map.has(senderBase)).toBe(true);
  });
});
