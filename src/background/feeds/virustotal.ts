import { RateLimiter } from '../rateLimiter';
import { VervainDB, VTCacheRecord } from '../db';

export interface VTDomainReport {
  reputation: number;
  domainAge: string;
  detectionRatio: string;
  rawResponse: Record<string, unknown>;
}

export class VirusTotalClient {
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private db: VervainDB;
  private cacheTTLMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(apiKey: string, db: VervainDB) {
    this.apiKey = apiKey;
    this.db = db;
    this.rateLimiter = new RateLimiter(4, 60000); // VT free tier: 4 req/min
  }

  async lookupDomain(domain: string): Promise<VTDomainReport | null> {
    // Check cache first
    const cached = await this.db.getVTCache(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        reputation: cached.reputation,
        domainAge: cached.domainAge,
        detectionRatio: cached.detectionRatio,
        rawResponse: cached.rawResponse,
      };
    }

    // Rate limit check
    if (!this.rateLimiter.canProceed()) {
      return null; // Rate limited — caller should retry later
    }

    this.rateLimiter.record();

    const response = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': this.apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 429) return null; // Rate limited
      throw new Error(`VT API error: ${response.status}`);
    }

    const data = await response.json();
    const attrs = data.data?.attributes ?? {};

    const report: VTDomainReport = {
      reputation: attrs.reputation ?? 0,
      domainAge: attrs.creation_date ? new Date(attrs.creation_date * 1000).toISOString().split('T')[0] : 'unknown',
      detectionRatio: `${attrs.last_analysis_stats?.malicious ?? 0}/${attrs.last_analysis_stats?.undetected ?? 0}`,
      rawResponse: data,
    };

    // Cache the result
    const now = Date.now();
    await this.db.setVTCache({
      domain,
      ...report,
      fetchedAt: now,
      expiresAt: now + this.cacheTTLMs,
    });

    return report;
  }
}
