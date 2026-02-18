import { describe, it, expect } from 'vitest';
import { BKTree, levenshtein } from '@/background/detection/bkTree';

describe('levenshtein', () => {
  it('identical strings → 0', () => expect(levenshtein('google', 'google')).toBe(0));
  it('single substitution → 1', () => expect(levenshtein('google', 'googl3')).toBe(1));
  it('single insertion → 1', () => expect(levenshtein('google', 'gooogle')).toBe(1));
  it('single deletion → 1', () => expect(levenshtein('google', 'gogle')).toBe(1));
  it('transposition counts as 2 ops', () => expect(levenshtein('google', 'googel')).toBe(2));
  it('empty vs non-empty', () => expect(levenshtein('', 'abc')).toBe(3));
});

describe('BKTree', () => {
  it('finds exact matches at distance 0', () => {
    const tree = new BKTree();
    tree.insert('google');
    tree.insert('microsoft');
    const results = tree.query('google', 0);
    expect(results).toEqual([{ word: 'google', distance: 0 }]);
  });

  it('finds typosquatting variants within distance 1', () => {
    const tree = new BKTree();
    tree.insert('google');
    const results = tree.query('googl3', 1);
    expect(results).toHaveLength(1);
    expect(results[0].word).toBe('google');
  });

  it('does not return distant strings', () => {
    const tree = new BKTree();
    tree.insert('google');
    const results = tree.query('microsoft', 2);
    expect(results).toHaveLength(0);
  });

  it('handles bulk insertion', () => {
    const tree = new BKTree();
    const domains = ['google', 'microsoft', 'apple', 'amazon', 'facebook'];
    for (const d of domains) tree.insert(d);
    const results = tree.query('gogle', 1);
    expect(results).toHaveLength(1);
    expect(results[0].word).toBe('google');
  });

  it('adaptive threshold: stricter for short domains', () => {
    const tree = new BKTree();
    tree.insert('box');
    // 'bax' is distance 1 from 'box', but for a 3-char domain,
    // max distance 1 = 33% difference — too high, should use maxDist 0
    const results = tree.query('bax', BKTree.adaptiveThreshold('bax'));
    // adaptiveThreshold('bax') should return 0 for 3-char strings
    expect(results).toHaveLength(0);
  });
});
