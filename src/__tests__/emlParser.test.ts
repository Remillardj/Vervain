import { describe, it, expect } from 'vitest';
import { parseEml } from '@/utils/emlParser';

const SIMPLE_EML = `From: John Doe <john@example.com>\r
Subject: Test Email\r
Content-Type: text/plain; charset="utf-8"\r
\r
Hello, this is a test email body.
Visit https://example.com for more info.`;

const HTML_EML = `From: "Jane Smith" <jane@corp.com>\r
Subject: Important Update\r
Content-Type: text/html; charset="utf-8"\r
\r
<html><body><p>Please <a href="https://evil.com/login">click here</a> to verify your account.</p></body></html>`;

const MULTIPART_EML = `From: Support <support@company.com>\r
Subject: Your Invoice\r
Content-Type: multipart/alternative; boundary="boundary123"\r
\r
--boundary123\r
Content-Type: text/plain; charset="utf-8"\r
\r
Your invoice is attached. See https://company.com/invoice/123\r
--boundary123\r
Content-Type: text/html; charset="utf-8"\r
\r
<html><body><p>Your invoice is attached.</p></body></html>\r
--boundary123--`;

const NAME_ONLY_FROM = `From: Marketing Team <marketing@brand.com>\r
Subject: Weekly Newsletter\r
\r
This week's updates...`;

const ANGLE_BRACKET_FROM = `From: <noreply@alerts.bank.com>\r
Subject: Security Alert\r
\r
Your account has been compromised.`;

describe('parseEml', () => {
  it('parses simple text/plain email', () => {
    const result = parseEml(SIMPLE_EML);
    expect(result.senderName).toBe('John Doe');
    expect(result.senderEmail).toBe('john@example.com');
    expect(result.subject).toBe('Test Email');
    expect(result.body).toContain('Hello, this is a test email body.');
    expect(result.urls).toContain('https://example.com');
  });

  it('strips HTML tags from html-only email', () => {
    const result = parseEml(HTML_EML);
    expect(result.senderName).toBe('Jane Smith');
    expect(result.senderEmail).toBe('jane@corp.com');
    expect(result.body).toContain('click here');
    expect(result.body).not.toContain('<html>');
    expect(result.urls).toContain('https://evil.com/login');
  });

  it('prefers text/plain in multipart/alternative', () => {
    const result = parseEml(MULTIPART_EML);
    expect(result.senderName).toBe('Support');
    expect(result.senderEmail).toBe('support@company.com');
    expect(result.subject).toBe('Your Invoice');
    expect(result.body).toContain('Your invoice is attached.');
    expect(result.urls).toContain('https://company.com/invoice/123');
  });

  it('parses From with display name', () => {
    const result = parseEml(NAME_ONLY_FROM);
    expect(result.senderName).toBe('Marketing Team');
    expect(result.senderEmail).toBe('marketing@brand.com');
  });

  it('handles From with angle brackets only (no name)', () => {
    const result = parseEml(ANGLE_BRACKET_FROM);
    expect(result.senderName).toBe('');
    expect(result.senderEmail).toBe('noreply@alerts.bank.com');
  });

  it('extracts multiple URLs from body', () => {
    const eml = `From: test@test.com\r\nSubject: Links\r\n\r\nCheck https://one.com and http://two.com/path?q=1 for details.`;
    const result = parseEml(eml);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://one.com');
    expect(result.urls).toContain('http://two.com/path?q=1');
  });

  it('returns empty urls array when no URLs present', () => {
    const eml = `From: test@test.com\r\nSubject: No links\r\n\r\nJust plain text, no links here.`;
    const result = parseEml(eml);
    expect(result.urls).toHaveLength(0);
  });

  it('handles folded (continuation) headers', () => {
    const eml = `From: Very Long Name That Wraps\r\n <wrapped@example.com>\r\nSubject: Folded\r\n\r\nBody text.`;
    const result = parseEml(eml);
    expect(result.senderEmail).toBe('wrapped@example.com');
  });
});
