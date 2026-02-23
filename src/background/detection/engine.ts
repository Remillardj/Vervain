import { BKTree } from './bkTree';
import { normalizeHomographs, buildNormalizedMap } from './homograph';
import { TokenMatcher } from './tokenMatcher';
import { BloomFilter } from './bloomFilter';

export type Verdict = 'clean' | 'warning' | 'suspicious';

export interface ScanVerdict {
  verdict: Verdict;
  rule: string;
  evidence: string;
}

export interface ScanInput {
  sender: string;
  domain: string;
  contactName: string;
}

interface RebuildData {
  domains: Array<{ domain: string; baseName: string }>;
  contacts: Array<{ name: string; email: string }>;
  threatDomains: string[];
}

export class DetectionEngine {
  private bkTree: BKTree = new BKTree();
  private normalizedMap: Map<string, string> = new Map();
  private tokenMatcher: TokenMatcher = new TokenMatcher([]);
  private bloomFilter: BloomFilter = new BloomFilter(100000, 0.001);
  private contactNameIndex: Map<string, Set<string>> = new Map(); // name → emails
  private protectedDomainSet: Set<string> = new Set();

  rebuild(data: RebuildData): void {
    // BK-tree
    this.bkTree = new BKTree();
    for (const d of data.domains) this.bkTree.insert(d.baseName);

    // Normalized form map
    this.normalizedMap = buildNormalizedMap(data.domains.map(d => d.domain));

    // Protected domain set
    this.protectedDomainSet = new Set(data.domains.map(d => d.domain.toLowerCase()));

    // Token matcher
    this.tokenMatcher = new TokenMatcher(data.domains.map(d => d.domain));

    // Bloom filter
    this.bloomFilter = new BloomFilter(Math.max(data.threatDomains.length * 2, 1000), 0.001);
    for (const d of data.threatDomains) this.bloomFilter.add(d.toLowerCase());

    // Contact name index
    this.contactNameIndex = new Map();
    for (const c of data.contacts) {
      const key = c.name.toLowerCase();
      if (!this.contactNameIndex.has(key)) {
        this.contactNameIndex.set(key, new Set());
      }
      this.contactNameIndex.get(key)!.add(c.email.toLowerCase());
    }
  }

  passiveScan(input: ScanInput): ScanVerdict {
    const domain = input.domain.toLowerCase();
    const clean: ScanVerdict = { verdict: 'clean', rule: '', evidence: '' };

    // Step 1: Exact match — skip if trusted
    if (this.protectedDomainSet.has(domain)) return clean;

    // Step 2: Extract base name
    const parts = domain.split('.');
    const baseName = parts.length > 1 ? parts[parts.length - 2] : parts[0];

    // Step 3: Token/structural attack check
    const tokenResult = this.tokenMatcher.check(domain);
    if (tokenResult) {
      return { verdict: 'suspicious', rule: `brand: ${tokenResult.rule}`, evidence: tokenResult.evidence };
    }

    // Step 4: Homograph check (O(1))
    const normalized = normalizeHomographs(baseName);
    const homographMatch = this.normalizedMap.get(normalized);
    if (homographMatch && homographMatch.toLowerCase() !== domain) {
      return { verdict: 'suspicious', rule: 'homograph', evidence: `"${domain}" normalizes to same form as "${homographMatch}"` };
    }

    // Step 5: BK-tree fuzzy match (O(log n))
    const threshold = BKTree.adaptiveThreshold(baseName);
    if (threshold > 0) {
      const bkResults = this.bkTree.query(baseName, threshold);
      for (const r of bkResults) {
        // Don't flag if it's the domain itself
        if (r.distance > 0) {
          return { verdict: 'warning', rule: 'typosquatting', evidence: `"${baseName}" is ${r.distance} edit(s) from protected domain "${r.word}"` };
        }
      }
    }

    // Step 6: Fuzzy token matching — individual tokens from sender domain through BK-tree
    if (baseName.includes('-')) {
      const tokens = baseName.split('-');
      for (const token of tokens) {
        if (token.length < 3) continue;
        const tokenThreshold = BKTree.adaptiveThreshold(token);
        if (tokenThreshold > 0) {
          const results = this.bkTree.query(token, tokenThreshold);
          for (const r of results) {
            if (r.distance > 0 && r.distance <= tokenThreshold) {
              return { verdict: 'warning', rule: 'fuzzy-token', evidence: `Token "${token}" in "${domain}" is ${r.distance} edit(s) from "${r.word}"` };
            }
          }
        }
        // Also check homograph on tokens
        const normToken = normalizeHomographs(token);
        if (this.normalizedMap.has(normToken)) {
          return { verdict: 'suspicious', rule: 'homograph-token', evidence: `Token "${token}" normalizes to match "${this.normalizedMap.get(normToken)}"` };
        }
      }
    }

    // Step 7: Bloom filter — known bad domain
    if (this.bloomFilter.has(domain)) {
      return { verdict: 'suspicious', rule: 'threat-feed', evidence: `"${domain}" matches cached threat feed` };
    }

    // Step 8: Contact name spoofing
    if (input.contactName) {
      const nameKey = input.contactName.toLowerCase();
      const knownEmails = this.contactNameIndex.get(nameKey);
      if (knownEmails && !knownEmails.has(input.sender.toLowerCase())) {
        const expected = Array.from(knownEmails).join(', ');
        return { verdict: 'suspicious', rule: 'contact-spoof', evidence: `"${input.contactName}" expected from ${expected}, got ${input.sender}` };
      }
    }

    return clean;
  }
}
