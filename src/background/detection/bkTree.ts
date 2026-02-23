export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimization
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

interface BKNode {
  word: string;
  children: Map<number, BKNode>;
}

export interface BKResult {
  word: string;
  distance: number;
}

export class BKTree {
  private root: BKNode | null = null;

  insert(word: string): void {
    if (!this.root) {
      this.root = { word, children: new Map() };
      return;
    }
    let node = this.root;
    while (true) {
      const d = levenshtein(word, node.word);
      if (d === 0) return; // duplicate
      const child = node.children.get(d);
      if (!child) {
        node.children.set(d, { word, children: new Map() });
        return;
      }
      node = child;
    }
  }

  query(word: string, maxDistance: number): BKResult[] {
    if (!this.root) return [];
    const results: BKResult[] = [];
    const stack: BKNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop()!;
      const d = levenshtein(word, node.word);
      if (d <= maxDistance) {
        results.push({ word: node.word, distance: d });
      }
      // Only explore children within [d - maxDistance, d + maxDistance]
      const lo = d - maxDistance;
      const hi = d + maxDistance;
      for (const [childDist, child] of node.children) {
        if (childDist >= lo && childDist <= hi) {
          stack.push(child);
        }
      }
    }
    return results;
  }

  /** Adaptive threshold: stricter for short domain base names */
  static adaptiveThreshold(baseName: string): number {
    const len = baseName.length;
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    if (len <= 8) return 2;
    return 3;
  }
}
