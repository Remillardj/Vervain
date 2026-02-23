import { describe, it, expect, beforeEach } from 'vitest';
import { TokenMatcher } from '@/background/detection/tokenMatcher';

describe('TokenMatcher', () => {
  let matcher: TokenMatcher;

  beforeEach(() => {
    matcher = new TokenMatcher(['google.com', 'microsoft.com', 'monarch.com']);
  });

  it('detects brand embedding: customer-support-google.com', () => {
    const result = matcher.check('customer-support-google.com');
    expect(result).toBeTruthy();
    expect(result!.rule).toBe('brand-embedding');
    expect(result!.matchedDomain).toBe('google.com');
  });

  it('detects subdomain impersonation: google.com.evil.com', () => {
    const result = matcher.check('google.com.evil.com');
    expect(result).toBeTruthy();
    expect(result!.rule).toBe('subdomain-impersonation');
  });

  it('detects subdomain combo: google-support.example.com', () => {
    const result = matcher.check('google-support.example.com');
    expect(result).toBeTruthy();
    expect(result!.rule).toBe('brand-embedding');
  });

  it('detects concatenation: googlesupport.com', () => {
    const result = matcher.check('googlesupport.com');
    expect(result).toBeTruthy();
    expect(result!.rule).toBe('brand-substring');
  });

  it('detects brand + phishing keyword: google-verify.com', () => {
    const result = matcher.check('google-verify.com');
    expect(result).toBeTruthy();
    expect(result!.rule).toBe('brand-keyword-combo');
  });

  it('does not flag the protected domain itself', () => {
    const result = matcher.check('google.com');
    expect(result).toBeNull();
  });

  it('does not flag legitimate subdomains: mail.google.com', () => {
    const result = matcher.check('mail.google.com');
    expect(result).toBeNull();
  });

  it('does not flag unrelated domains', () => {
    const result = matcher.check('example.com');
    expect(result).toBeNull();
  });
});
