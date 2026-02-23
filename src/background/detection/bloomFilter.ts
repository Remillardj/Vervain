/**
 * Bloom filter for fast probabilistic set membership testing.
 * Used for O(1) known-bad domain checks against cached threat feeds.
 */
export class BloomFilter {
  private bits: Uint8Array;
  private numHashes: number;
  private numBits: number;

  constructor(expectedItems: number, falsePositiveRate: number) {
    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    this.numBits = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2));
    // Optimal number of hash functions: k = (m/n) * ln(2)
    this.numHashes = Math.ceil((this.numBits / expectedItems) * Math.LN2);
    this.bits = new Uint8Array(Math.ceil(this.numBits / 8));
  }

  private hash(value: string, seed: number): number {
    // FNV-1a hash variant with seed
    let h = 2166136261 ^ seed;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % this.numBits;
  }

  add(value: string): void {
    for (let i = 0; i < this.numHashes; i++) {
      const bit = this.hash(value, i);
      this.bits[bit >> 3] |= 1 << (bit & 7);
    }
  }

  has(value: string): boolean {
    for (let i = 0; i < this.numHashes; i++) {
      const bit = this.hash(value, i);
      if ((this.bits[bit >> 3] & (1 << (bit & 7))) === 0) {
        return false;
      }
    }
    return true;
  }

  sizeInBytes(): number {
    return this.bits.byteLength;
  }

  clear(): void {
    this.bits.fill(0);
  }
}
