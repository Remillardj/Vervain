import { describe, it, expect } from 'vitest';
import { BloomFilter } from '@/background/detection/bloomFilter';

describe('BloomFilter', () => {
  it('returns true for inserted items', () => {
    const bf = new BloomFilter(1000, 0.001);
    bf.add('evil.com');
    bf.add('phishing.org');
    expect(bf.has('evil.com')).toBe(true);
    expect(bf.has('phishing.org')).toBe(true);
  });

  it('returns false for items not inserted (with high probability)', () => {
    const bf = new BloomFilter(1000, 0.001);
    bf.add('evil.com');
    // Test several non-inserted items — false positive rate should be very low
    let falsePositives = 0;
    for (let i = 0; i < 100; i++) {
      if (bf.has(`random-domain-${i}.com`)) falsePositives++;
    }
    expect(falsePositives).toBeLessThan(5); // Allow up to 5% in test
  });

  it('handles bulk insertion from domain list', () => {
    const bf = new BloomFilter(100000, 0.001);
    const domains = Array.from({ length: 1000 }, (_, i) => `domain-${i}.com`);
    for (const d of domains) bf.add(d);
    // All inserted domains should be found
    for (const d of domains) {
      expect(bf.has(d)).toBe(true);
    }
  });

  it('reports size in bytes', () => {
    const bf = new BloomFilter(100000, 0.001);
    // 100k items at 0.1% FP ≈ ~120KB
    expect(bf.sizeInBytes()).toBeGreaterThan(100000);
    expect(bf.sizeInBytes()).toBeLessThan(200000);
  });
});
