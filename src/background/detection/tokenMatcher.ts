const PHISHING_KEYWORDS = new Set([
  'verify', 'login', 'support', 'security', 'account', 'helpdesk',
  'update', 'confirm', 'signin', 'password', 'billing', 'payment',
  'secure', 'alert', 'notification', 'service', 'admin', 'auth',
]);

export interface TokenMatchResult {
  rule: 'brand-embedding' | 'subdomain-impersonation' | 'brand-substring' | 'brand-keyword-combo';
  matchedDomain: string;
  matchedToken: string;
  evidence: string;
}

export class TokenMatcher {
  private brandTokens: Map<string, string>; // token → full domain
  private protectedDomains: Set<string>;

  constructor(domains: string[]) {
    this.brandTokens = new Map();
    this.protectedDomains = new Set(domains.map(d => d.toLowerCase()));

    for (const domain of domains) {
      const parts = domain.split('.');
      const baseName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      this.brandTokens.set(baseName.toLowerCase(), domain.toLowerCase());
    }
  }

  check(senderDomain: string): TokenMatchResult | null {
    const domain = senderDomain.toLowerCase();

    // Skip if it's one of our protected domains
    if (this.protectedDomains.has(domain)) return null;

    // Skip legitimate subdomains (e.g., mail.google.com for google.com)
    for (const protected_ of this.protectedDomains) {
      if (domain.endsWith('.' + protected_)) return null;
    }

    // Extract base name of sender domain
    const senderParts = domain.split('.');
    const senderBase = senderParts.length > 1 ? senderParts[senderParts.length - 2] : senderParts[0];

    for (const [token, protectedDomain] of this.brandTokens) {
      if (token.length < 3) continue; // Skip very short brand names to reduce false positives

      // 1. Subdomain impersonation: google.com.evil.com
      // Check if the full protected domain appears as a subdomain prefix
      if (senderParts.length > 2) {
        const subdomainPortion = senderParts.slice(0, -2).join('.');
        if (subdomainPortion === protectedDomain || subdomainPortion.endsWith('.' + protectedDomain) || subdomainPortion.startsWith(protectedDomain + '.')) {
          return { rule: 'subdomain-impersonation', matchedDomain: protectedDomain, matchedToken: token, evidence: `Protected domain "${protectedDomain}" used as subdomain in "${domain}"` };
        }
      }

      const baseParts = senderBase.split('-');

      // 2. Brand + phishing keyword combo: google-verify.com (exactly 2 segments)
      if (baseParts.length === 2) {
        const hasToken = baseParts.some(p => p === token || p.includes(token));
        const hasKeyword = baseParts.some(p => PHISHING_KEYWORDS.has(p));
        if (hasToken && hasKeyword) {
          return { rule: 'brand-keyword-combo', matchedDomain: protectedDomain, matchedToken: token, evidence: `Brand "${token}" + phishing keyword in "${senderBase}"` };
        }
      }

      // 3. Brand embedding in base name: customer-support-google.com
      // The brand token appears as a hyphenated segment
      if (baseParts.length > 1 && baseParts.includes(token)) {
        return { rule: 'brand-embedding', matchedDomain: protectedDomain, matchedToken: token, evidence: `Brand "${token}" embedded in "${senderBase}"` };
      }

      // 4. Brand embedding in subdomains: google-support.example.com
      for (const part of senderParts.slice(0, -2)) {
        const subParts = part.split('-');
        if (subParts.includes(token)) {
          return { rule: 'brand-embedding', matchedDomain: protectedDomain, matchedToken: token, evidence: `Brand "${token}" in subdomain "${part}"` };
        }
      }

      // 5. Brand substring: googlesupport.com (token appears within base name)
      if (senderBase !== token && senderBase.includes(token)) {
        return { rule: 'brand-substring', matchedDomain: protectedDomain, matchedToken: token, evidence: `"${senderBase}" contains brand "${token}"` };
      }
    }

    return null;
  }
}
