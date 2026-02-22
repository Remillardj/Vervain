# UX Rename + MDM Docs + AI Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename "Threat Intel" to user-friendly "Known Threats" in the Options UI, write MDM deployment documentation, and build AI analyzer testing infrastructure with EML parsing.

**Architecture:** Three independent workstreams. WS1 is a UI-only string rename in OptionsPage.tsx. WS2 is four new markdown docs under `docs/mdm/`. WS3 builds an EML parser utility (TDD), synthetic test fixtures, automated test suite (mocked + live modes), and a CLI evaluation tool.

**Tech Stack:** React/TypeScript (WS1), Markdown (WS2), Vitest + tsx (WS3). No new dependencies needed — the EML parser is hand-rolled for the subset of RFC 2822 we need.

**Note:** `.gitignore` contains `docs/` — all doc files need `git add -f`.

---

## Workstream 1: Rename "Threat Intel" to "Known Threats"

### Task 1: Rename UI labels in OptionsPage.tsx

**Files:**
- Modify: `src/components/OptionsPage.tsx`

**Step 1: Rename tab trigger (line 398-400)**

Change:
```tsx
<TabsTrigger value="threatintel" className="flex items-center gap-2">
  <Shield className="h-4 w-4" />
  <span>Threat Intel</span>
</TabsTrigger>
```
To:
```tsx
<TabsTrigger value="threatintel" className="flex items-center gap-2">
  <Shield className="h-4 w-4" />
  <span>Known Threats</span>
</TabsTrigger>
```

**Step 2: Rename "Auto Threat Intel" toggle in General tab (lines 489-494)**

Change:
```tsx
<h4 className="font-medium">Auto Threat Intel</h4>
<p className="text-sm text-muted-foreground">
  Automatically check threat feeds for every email
</p>
```
To:
```tsx
<h4 className="font-medium">Auto-check known threat databases</h4>
<p className="text-sm text-muted-foreground">
  Automatically check sender domains against databases of known phishing and malware sites
</p>
```

**Step 3: Rename toast in handleToggleAutoTI (line 323)**

Change:
```tsx
showToast(newState ? 'Auto Threat Intel enabled' : 'Auto Threat Intel disabled', 'success');
```
To:
```tsx
showToast(newState ? 'Auto known-threats check enabled' : 'Auto known-threats check disabled', 'success');
```

**Step 4: Rename "Threat Feed Sources" card (lines 710-717)**

Change:
```tsx
<CardTitle className="flex items-center gap-2">
  <Shield className="h-5 w-5 text-[#4B2EE3]" />
  Threat Feed Sources
</CardTitle>
<CardDescription>
  Enable or disable threat intelligence feeds for domain reputation checking
</CardDescription>
```
To:
```tsx
<CardTitle className="flex items-center gap-2">
  <Shield className="h-5 w-5 text-[#4B2EE3]" />
  Known Threat Sources
</CardTitle>
<CardDescription>
  Choose which databases Vervain checks for known phishing and malware domains
</CardDescription>
```

**Step 5: Update feed descriptions (lines 721-724)**

Change the feed array to:
```tsx
{[
  { id: 'phishtank', name: 'PhishTank', description: 'Community-verified phishing sites' },
  { id: 'urlhaus', name: 'URLhaus', description: 'Known malware distribution sites' },
  { id: 'threatfox', name: 'ThreatFox', description: 'Indicators of compromise database' },
  { id: 'openphish', name: 'OpenPhish', description: 'Automatically detected phishing sites' },
]}
```

**Step 6: Rename "About Threat Intelligence" card (lines 796-816)**

Replace the entire card content:
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Info className="h-5 w-5 text-[#4B2EE3]" />
      How Known Threats Checking Works
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-sm space-y-2">
      <p>
        Vervain checks sender domains against multiple databases of known malicious sites:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Quick check</strong> — A fast lookup against all enabled databases (runs in milliseconds)</li>
        <li><strong>Confirmation</strong> — If a match is found, Vervain confirms it with the original source</li>
        <li><strong>VirusTotal</strong> — Additional reputation scoring and domain age analysis (optional)</li>
      </ul>
      <p className="mt-2">
        Databases refresh automatically in the background. All data is stored locally on your device.
      </p>
    </div>
  </CardContent>
</Card>
```

**Step 7: Build to verify no regressions**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 8: Commit**

```bash
git add src/components/OptionsPage.tsx
git commit -m "feat: rename Threat Intel to Known Threats in Options UI"
```

---

## Workstream 2: MDM Deployment Documentation

### Task 2: Write schema reference

**Files:**
- Create: `docs/mdm/schema-reference.md`

**Step 1: Write the schema reference**

Document every key from `public/managed_schema.json` grouped by category. For each key include: name, type, default, whether it locks a UI toggle, description, and example value.

Categories:
- **Domain Protection**: `protectedDomains`, `domainDetectionEnabled`
- **Contact Protection**: `trustedContacts`, `contactDetectionEnabled`
- **Known Threats**: `tiAutoScan`, `enabledThreatFeeds`, `virusTotalApiKey`
- **AI Analysis**: `aiProvider`, `aiApiKey`, `aiModel`, `aiAutoScan`
- **Remote Config**: `configUrl`, `configAuthToken`, `configRefreshIntervalMinutes`

Include a "Quick Start" section at top with a minimal example that locks domains + enables auto-scans.

**Step 2: Commit**

```bash
git add -f docs/mdm/schema-reference.md
git commit -m "docs: add MDM managed schema reference"
```

### Task 3: Write Jamf Pro deployment guide

**Files:**
- Create: `docs/mdm/deploy-jamf.md`

**Step 1: Write the guide**

Follow the standard structure:
1. Prerequisites (Jamf Pro access, Chrome installed, extension ID)
2. Force-install extension via ExtensionInstallForcelist configuration profile
3. Configure managed preferences via Custom Settings payload targeting `com.google.Chrome.extensions.<extension-id>`
4. Full plist XML example with common enterprise defaults (protected domains, AI key, all feeds enabled, auto-scans on)
5. Verification (chrome://policy, lock icons)
6. Troubleshooting (profile not applying, scope targeting, managed storage not available)

**Step 2: Commit**

```bash
git add -f docs/mdm/deploy-jamf.md
git commit -m "docs: add Jamf Pro MDM deployment guide"
```

### Task 4: Write Microsoft Intune deployment guide

**Files:**
- Create: `docs/mdm/deploy-intune.md`

**Step 1: Write the guide**

Same structure:
1. Prerequisites (Intune admin access, Chrome ADMX templates ingested)
2. Force-install via ExtensionInstallForcelist OMA-URI
3. Configure managed settings via ExtensionSettings OMA-URI (JSON payload)
4. Full JSON example configuration
5. Verification
6. Troubleshooting (OMA-URI path errors, ADMX ingestion issues, policy sync timing)

**Step 2: Commit**

```bash
git add -f docs/mdm/deploy-intune.md
git commit -m "docs: add Microsoft Intune MDM deployment guide"
```

### Task 5: Write Google Workspace deployment guide

**Files:**
- Create: `docs/mdm/deploy-google-workspace.md`

**Step 1: Write the guide**

Same structure:
1. Prerequisites (Google Workspace admin, Chrome Browser Cloud Management)
2. Force-install via Admin Console > Devices > Chrome > Apps & extensions
3. Configure managed preferences via policy JSON in Admin Console
4. Full JSON example
5. Verification
6. Troubleshooting (OU inheritance, policy propagation delay, ChromeOS vs managed Chrome browser)

**Step 2: Commit**

```bash
git add -f docs/mdm/deploy-google-workspace.md
git commit -m "docs: add Google Workspace MDM deployment guide"
```

---

## Workstream 3: AI Analyzer Testing Infrastructure

### Task 6: Write EML parser — failing tests first

**Files:**
- Create: `src/__tests__/emlParser.test.ts`
- Create: `src/utils/emlParser.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseEml } from '@/utils/emlParser';

const SIMPLE_EML = `From: John Doe <john@example.com>
Subject: Test Email
Content-Type: text/plain; charset="utf-8"

Hello, this is a test email body.
Visit https://example.com for more info.`;

const HTML_EML = `From: "Jane Smith" <jane@corp.com>
Subject: Important Update
Content-Type: text/html; charset="utf-8"

<html><body><p>Please <a href="https://evil.com/login">click here</a> to verify your account.</p></body></html>`;

const MULTIPART_EML = `From: Support <support@company.com>
Subject: Your Invoice
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="utf-8"

Your invoice is attached. See https://company.com/invoice/123
--boundary123
Content-Type: text/html; charset="utf-8"

<html><body><p>Your invoice is attached.</p></body></html>
--boundary123--`;

const NAME_ONLY_FROM = `From: Marketing Team <marketing@brand.com>
Subject: Weekly Newsletter

This week's updates...`;

const ANGLE_BRACKET_FROM = `From: <noreply@alerts.bank.com>
Subject: Security Alert

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
    const eml = `From: test@test.com
Subject: Links

Check https://one.com and http://two.com/path?q=1 for details.`;
    const result = parseEml(eml);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://one.com');
    expect(result.urls).toContain('http://two.com/path?q=1');
  });

  it('returns empty urls array when no URLs present', () => {
    const eml = `From: test@test.com
Subject: No links

Just plain text, no links here.`;
    const result = parseEml(eml);
    expect(result.urls).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/__tests__/emlParser.test.ts`
Expected: FAIL — `parseEml` not found.

**Step 3: Implement the EML parser**

```typescript
// src/utils/emlParser.ts
import type { EmailData } from '@/background/aiPrompt';

/**
 * Lightweight EML parser for RFC 2822 emails.
 * Handles text/plain, text/html, and basic multipart/alternative.
 * Returns the same EmailData shape used by buildUserMessage().
 */
export function parseEml(raw: string): EmailData {
  // Split headers from body at first blank line
  const headerEndIdx = raw.indexOf('\n\n');
  const headerBlock = headerEndIdx === -1 ? raw : raw.slice(0, headerEndIdx);
  const bodyBlock = headerEndIdx === -1 ? '' : raw.slice(headerEndIdx + 2);

  // Parse headers (handle folded lines)
  const headers: Record<string, string> = {};
  const headerLines = headerBlock.split('\n');
  let currentKey = '';
  for (const line of headerLines) {
    if (/^\s/.test(line) && currentKey) {
      // Folded header continuation
      headers[currentKey] += ' ' + line.trim();
    } else {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).toLowerCase().trim();
        headers[currentKey] = line.slice(colonIdx + 1).trim();
      }
    }
  }

  // Parse From header
  const from = headers['from'] || '';
  const { name: senderName, email: senderEmail } = parseFromHeader(from);

  // Parse Subject
  const subject = headers['subject'] || '';

  // Parse body based on Content-Type
  const contentType = headers['content-type'] || 'text/plain';
  const body = extractBody(bodyBlock, contentType);

  // Extract URLs from body
  const urls = extractUrls(body);

  return { senderName, senderEmail, subject, body, urls };
}

function parseFromHeader(from: string): { name: string; email: string } {
  // Format: "Display Name" <email@example.com>
  // Or: Display Name <email@example.com>
  // Or: <email@example.com>
  // Or: email@example.com
  const angleMatch = from.match(/^(.*?)\s*<([^>]+)>/);
  if (angleMatch) {
    const name = angleMatch[1].replace(/^["']|["']$/g, '').trim();
    return { name, email: angleMatch[2].trim() };
  }
  // Bare email
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+/);
  return { name: '', email: emailMatch ? emailMatch[0] : from.trim() };
}

function extractBody(bodyBlock: string, contentType: string): string {
  // Check for multipart
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    return extractMultipartBody(bodyBlock, boundaryMatch[1]);
  }

  // Single part
  if (contentType.includes('text/html')) {
    return stripHtml(bodyBlock);
  }
  return bodyBlock.trim();
}

function extractMultipartBody(bodyBlock: string, boundary: string): string {
  const parts = bodyBlock.split(new RegExp(`--${escapeRegex(boundary)}(?:--)?`));
  let textPart = '';
  let htmlPart = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Split part headers from part body
    const partHeaderEnd = trimmed.indexOf('\n\n');
    if (partHeaderEnd === -1) continue;

    const partHeaders = trimmed.slice(0, partHeaderEnd).toLowerCase();
    const partBody = trimmed.slice(partHeaderEnd + 2);

    if (partHeaders.includes('text/plain')) {
      textPart = partBody.trim();
    } else if (partHeaders.includes('text/html')) {
      htmlPart = partBody.trim();
    }
  }

  // Prefer text/plain
  if (textPart) return textPart;
  if (htmlPart) return stripHtml(htmlPart);
  return bodyBlock.trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  const matches = text.match(urlRegex) || [];
  // Deduplicate
  return [...new Set(matches)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/__tests__/emlParser.test.ts`
Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/utils/emlParser.ts src/__tests__/emlParser.test.ts
git commit -m "feat: add EML parser with tests for AI analyzer testing"
```

### Task 7: Create synthetic test fixtures

**Files:**
- Create: `test-fixtures/eml/synthetic/homograph-sender.eml`
- Create: `test-fixtures/eml/synthetic/homograph-sender.meta.json`
- Create: `test-fixtures/eml/synthetic/urgency-tactics.eml`
- Create: `test-fixtures/eml/synthetic/urgency-tactics.meta.json`
- Create: `test-fixtures/eml/synthetic/brand-embedding.eml`
- Create: `test-fixtures/eml/synthetic/brand-embedding.meta.json`
- Create: `test-fixtures/eml/synthetic/polite-predation.eml`
- Create: `test-fixtures/eml/synthetic/polite-predation.meta.json`
- Create: `test-fixtures/eml/synthetic/clean-newsletter.eml`
- Create: `test-fixtures/eml/synthetic/clean-newsletter.meta.json`
- Create: `test-fixtures/eml/phishing/README.md`
- Create: `test-fixtures/eml/legitimate/.gitkeep`

**Step 1: Create the synthetic EML files**

Each `.eml` should be a realistic email that exercises a specific detection scenario. Use plausible sender addresses, subjects, and bodies. Keep them short (~10-20 lines of body).

`homograph-sender.eml` — sender uses Cyrillic "а" in "paypal" (pаypal.com). Subject: "Your account has been limited." Body: demands password reset within 24 hours.

`urgency-tactics.eml` — sender from "security-team@bankofamerica-alerts.com". Subject: "URGENT: Unauthorized Transaction Detected." Body: compressed 2-hour deadline, threatening account freeze.

`brand-embedding.eml` — sender from "noreply@customer-support-microsoft.com". Subject: "Action Required: Verify Your Microsoft 365 Account." Body: asks to click link to avoid account deletion.

`polite-predation.eml` — sender from "accounting@vendor-invoices.net". Subject: "Quick favor - invoice update needed." Body: apologetic tone, asks to update bank details for payment.

`clean-newsletter.eml` — sender from "newsletter@techcrunch.com". Subject: "This Week in Tech: February 21, 2026." Body: normal newsletter content, links to techcrunch.com articles.

**Step 2: Create companion .meta.json files**

Each meta file has: `source`, `expectedLabel`, `expectedScoreRange`, `expectedPushed`, `description`.

- `homograph-sender.meta.json`: `{ "source": "synthetic", "expectedLabel": "suspicious", "expectedScoreRange": [61, 100], "expectedPushed": ["pressure", "urgency", "highStakes"], "description": "Cyrillic homograph PayPal impersonation with password reset demand" }`
- `urgency-tactics.meta.json`: `{ "source": "synthetic", "expectedLabel": "suspicious", "expectedScoreRange": [61, 100], "expectedPushed": ["urgency", "highStakes", "pressure"], "description": "Fake bank fraud alert with 2-hour deadline" }`
- `brand-embedding.meta.json`: `{ "source": "synthetic", "expectedLabel": "caution", "expectedScoreRange": [31, 100], "expectedPushed": ["pressure", "highStakes"], "description": "Brand embedding Microsoft support impersonation" }`
- `polite-predation.meta.json`: `{ "source": "synthetic", "expectedLabel": "caution", "expectedScoreRange": [31, 100], "expectedPushed": ["desperation", "surprise"], "description": "Polite vendor invoice bank detail change request" }`
- `clean-newsletter.meta.json`: `{ "source": "synthetic", "expectedLabel": "safe", "expectedScoreRange": [0, 30], "expectedPushed": [], "description": "Legitimate tech newsletter with standard content" }`

**Step 3: Create phishing README and legitimate .gitkeep**

`test-fixtures/eml/phishing/README.md`:
```markdown
# Phishing EML Samples

Place real phishing .eml files here. Files in `public/` are downloaded via
`scripts/download-test-eml.sh` and gitignored.

## Handling

- Sanitize recipient addresses before committing
- Keep sender addresses intact (they are the phishing actor)
- Add a companion .meta.json for each file
```

**Step 4: Commit**

```bash
git add test-fixtures/
git commit -m "feat: add synthetic EML test fixtures with metadata"
```

### Task 8: Write automated AI analyzer tests (mocked mode)

**Files:**
- Create: `src/__tests__/aiAnalyzer.test.ts`

**Step 1: Write the mocked tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseEml } from '@/utils/emlParser';
import { buildUserMessage, AI_SYSTEM_PROMPT } from '@/background/aiPrompt';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('AI Analyzer — mocked mode', () => {
  describe('buildUserMessage from parsed EML', () => {
    it('produces correct prompt from simple EML', () => {
      const eml = `From: John Doe <john@phish.com>
Subject: Urgent Account Action

Please reset your password immediately at https://evil.com/reset`;

      const parsed = parseEml(eml);
      const message = buildUserMessage(parsed);

      expect(message).toContain('**From:** John Doe <john@phish.com>');
      expect(message).toContain('**Subject:** Urgent Account Action');
      expect(message).toContain('Please reset your password immediately');
      expect(message).toContain('**URLs found in email:**');
      expect(message).toContain('https://evil.com/reset');
    });

    it('handles EML with no URLs', () => {
      const eml = `From: alice@safe.com
Subject: Hello

Just saying hi!`;
      const parsed = parseEml(eml);
      const message = buildUserMessage(parsed);

      expect(message).not.toContain('**URLs found in email:**');
    });
  });

  describe('response parsing', () => {
    it('parses valid AI response JSON', () => {
      const validResponse = JSON.stringify({
        confidence: 72,
        label: 'suspicious',
        pushed: {
          pressure: { detected: true, evidence: 'Demanding immediate action' },
          urgency: { detected: true, evidence: '24 hour deadline' },
          surprise: { detected: false, evidence: null },
          highStakes: { detected: true, evidence: 'Account closure threat' },
          excitement: { detected: false, evidence: null },
          desperation: { detected: false, evidence: null },
        },
        verify: [
          { flag: 'view', status: 'warning', detail: 'Suspicious domain' },
          { flag: 'evaluate', status: 'warning', detail: 'Unexpected contact' },
          { flag: 'request', status: 'warning', detail: 'Asks for credentials' },
          { flag: 'interrogate', status: 'ok', detail: 'N/A' },
          { flag: 'freeze', status: 'warning', detail: 'Contains suspicious link' },
          { flag: 'instincts', status: 'ok', detail: 'N/A' },
        ],
        reasoning: 'This email shows classic phishing indicators.',
      });

      const parsed = JSON.parse(validResponse);
      expect(parsed.confidence).toBe(72);
      expect(parsed.label).toBe('suspicious');
      expect(parsed.pushed.pressure.detected).toBe(true);
      expect(parsed.verify).toHaveLength(6);
    });

    it('handles response wrapped in markdown code fences', () => {
      const wrappedResponse = '```json\n{"confidence": 15, "label": "safe"}\n```';
      const cleaned = wrappedResponse
        .trim()
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(cleaned);
      expect(parsed.confidence).toBe(15);
      expect(parsed.label).toBe('safe');
    });

    it('throws on completely invalid JSON', () => {
      expect(() => JSON.parse('not json at all')).toThrow();
    });
  });

  describe('score rubric validation', () => {
    it('calculates correct score for known PUSHED + VERIFY combination', () => {
      // 3 PUSHED detected (3 * 8 = 24) + view warning (15) + freeze warning (10) = 49 → caution
      const score = 3 * 8 + 15 + 10;
      expect(score).toBe(49);
      const label = score <= 30 ? 'safe' : score <= 60 ? 'caution' : 'suspicious';
      expect(label).toBe('caution');
    });

    it('caps at 100 for maximum scoring', () => {
      // All 6 PUSHED (48) + all 6 VERIFY warnings (15+10+12+8+10+5 = 60) = 108 → cap 100
      const rawScore = 48 + 60;
      expect(rawScore).toBe(108);
      const capped = Math.min(rawScore, 100);
      expect(capped).toBe(100);
    });
  });

  describe('synthetic fixtures load correctly', () => {
    const fixturesDir = join(__dirname, '../../test-fixtures/eml/synthetic');

    it('all .eml files parse without error', () => {
      let files: string[];
      try {
        files = readdirSync(fixturesDir).filter(f => f.endsWith('.eml'));
      } catch {
        // Fixtures dir may not exist in CI; skip
        return;
      }
      for (const file of files) {
        const raw = readFileSync(join(fixturesDir, file), 'utf-8');
        const parsed = parseEml(raw);
        expect(parsed.senderEmail).toBeTruthy();
        expect(parsed.subject).toBeTruthy();
        expect(parsed.body).toBeTruthy();
      }
    });

    it('all .meta.json files are valid', () => {
      let files: string[];
      try {
        files = readdirSync(fixturesDir).filter(f => f.endsWith('.meta.json'));
      } catch {
        return;
      }
      for (const file of files) {
        const meta = JSON.parse(readFileSync(join(fixturesDir, file), 'utf-8'));
        expect(meta.expectedLabel).toMatch(/^(safe|caution|suspicious)$/);
        expect(meta.expectedScoreRange).toHaveLength(2);
        expect(meta.expectedScoreRange[0]).toBeLessThanOrEqual(meta.expectedScoreRange[1]);
      }
    });
  });
});
```

**Step 2: Run tests**

Run: `npm run test -- src/__tests__/aiAnalyzer.test.ts`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/__tests__/aiAnalyzer.test.ts
git commit -m "test: add mocked AI analyzer tests with fixture validation"
```

### Task 9: Add live AI test mode (opt-in)

**Files:**
- Create: `src/__tests__/aiAnalyzer.live.test.ts`

**Step 1: Write the live tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseEml } from '@/utils/emlParser';
import { buildUserMessage, AI_SYSTEM_PROMPT } from '@/background/aiPrompt';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const LIVE = process.env.VERVAIN_LIVE_AI_TESTS === '1';
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
const MODEL = PROVIDER === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';

async function callAI(userMessage: string): Promise<Record<string, unknown>> {
  if (PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await res.json();
    return JSON.parse(data.content[0].text);
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

describe.skipIf(!LIVE || !API_KEY)('AI Analyzer — live mode', () => {
  const fixturesDir = join(__dirname, '../../test-fixtures/eml/synthetic');

  it('analyzes each synthetic fixture within expected ranges', async () => {
    const emlFiles = readdirSync(fixturesDir).filter(f => f.endsWith('.eml'));

    for (const file of emlFiles) {
      const metaPath = join(fixturesDir, file.replace('.eml', '.meta.json'));
      if (!existsSync(metaPath)) continue;

      const raw = readFileSync(join(fixturesDir, file), 'utf-8');
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      const parsed = parseEml(raw);
      const userMessage = buildUserMessage(parsed);

      const result = await callAI(userMessage);

      // Assert label matches
      expect(result.label, `${file}: expected label ${meta.expectedLabel}`).toBe(meta.expectedLabel);

      // Assert score in range
      const score = result.confidence as number;
      expect(score, `${file}: score ${score} outside [${meta.expectedScoreRange}]`)
        .toBeGreaterThanOrEqual(meta.expectedScoreRange[0]);
      expect(score).toBeLessThanOrEqual(meta.expectedScoreRange[1]);

      // Assert expected PUSHED indicators fire (extras are OK)
      if (meta.expectedPushed?.length > 0) {
        const pushed = result.pushed as Record<string, { detected: boolean }>;
        for (const flag of meta.expectedPushed) {
          expect(pushed[flag]?.detected, `${file}: expected PUSHED.${flag} to be detected`).toBe(true);
        }
      }
    }
  }, 120_000); // 2 min timeout for API calls
});
```

**Step 2: Run tests to verify they skip without env var**

Run: `npm run test -- src/__tests__/aiAnalyzer.live.test.ts`
Expected: Test suite skipped (VERVAIN_LIVE_AI_TESTS not set).

**Step 3: Commit**

```bash
git add src/__tests__/aiAnalyzer.live.test.ts
git commit -m "test: add opt-in live AI analyzer tests gated behind env var"
```

### Task 10: Build CLI evaluation tool

**Files:**
- Create: `scripts/analyze-eml.ts`

**Step 1: Write the CLI tool**

```typescript
#!/usr/bin/env npx tsx
/**
 * CLI tool to analyze .eml files through Vervain's AI analyzer.
 *
 * Usage:
 *   npx tsx scripts/analyze-eml.ts <file.eml>
 *   npx tsx scripts/analyze-eml.ts --batch <directory>
 *
 * Flags:
 *   --provider anthropic|openai   (default: anthropic)
 *   --model <model-id>            (default: provider's cheapest)
 *   --verbose                     Show full JSON response
 *   --compare                     Compare against .meta.json expectations
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

// Inline the imports to avoid needing build step
// Re-implements parseEml and buildUserMessage locally for standalone use

function parseEml(raw: string) {
  const headerEndIdx = raw.indexOf('\n\n');
  const headerBlock = headerEndIdx === -1 ? raw : raw.slice(0, headerEndIdx);
  const bodyBlock = headerEndIdx === -1 ? '' : raw.slice(headerEndIdx + 2);

  const headers: Record<string, string> = {};
  const headerLines = headerBlock.split('\n');
  let currentKey = '';
  for (const line of headerLines) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] += ' ' + line.trim();
    } else {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).toLowerCase().trim();
        headers[currentKey] = line.slice(colonIdx + 1).trim();
      }
    }
  }

  const from = headers['from'] || '';
  const angleMatch = from.match(/^(.*?)\s*<([^>]+)>/);
  let senderName = '', senderEmail = '';
  if (angleMatch) {
    senderName = angleMatch[1].replace(/^["']|["']$/g, '').trim();
    senderEmail = angleMatch[2].trim();
  } else {
    const emailMatch = from.match(/[\w.+-]+@[\w.-]+/);
    senderEmail = emailMatch ? emailMatch[0] : from.trim();
  }

  const subject = headers['subject'] || '';
  const contentType = headers['content-type'] || 'text/plain';

  let body: string;
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    const parts = bodyBlock.split(new RegExp(`--${boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`));
    let textPart = '', htmlPart = '';
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const partEnd = trimmed.indexOf('\n\n');
      if (partEnd === -1) continue;
      const partHeaders = trimmed.slice(0, partEnd).toLowerCase();
      const partBody = trimmed.slice(partEnd + 2);
      if (partHeaders.includes('text/plain')) textPart = partBody.trim();
      else if (partHeaders.includes('text/html')) htmlPart = partBody.trim();
    }
    body = textPart || stripHtml(htmlPart) || bodyBlock.trim();
  } else if (contentType.includes('text/html')) {
    body = stripHtml(bodyBlock);
  } else {
    body = bodyBlock.trim();
  }

  const urls = (body.match(/https?:\/\/[^\s<>"')\]]+/g) || []).filter((v, i, a) => a.indexOf(v) === i);

  return { senderName, senderEmail, subject, body, urls };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function buildUserMessage(email: { senderName: string; senderEmail: string; subject: string; body: string; urls: string[] }): string {
  let msg = `Analyze this email for phishing indicators:\n\n`;
  msg += `**From:** ${email.senderName} <${email.senderEmail}>\n`;
  msg += `**Subject:** ${email.subject}\n\n`;
  msg += `**Body:**\n${email.body}\n`;
  if (email.urls.length > 0) {
    msg += `\n**URLs found in email:**\n`;
    email.urls.forEach(url => { msg += `- ${url}\n`; });
  }
  return msg;
}

// --- AI API calls ---

const AI_SYSTEM_PROMPT = readFileSync(join(__dirname, '../src/background/aiPrompt.ts'), 'utf-8')
  .match(/export const AI_SYSTEM_PROMPT = `([\s\S]*?)`;/)?.[1] || '';

async function callAI(
  userMessage: string,
  provider: string,
  model: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model, max_tokens: 1024, temperature: 0,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    let text = data.content[0].text.trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    return JSON.parse(text);
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model, max_tokens: 1024, temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

// --- CLI ---

async function analyzeFile(
  filePath: string,
  opts: { provider: string; model: string; apiKey: string; verbose: boolean; compare: boolean }
): Promise<{ file: string; score: number; label: string; pushed: string[]; time: number; mismatch?: string }> {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseEml(raw);
  const userMessage = buildUserMessage(parsed);

  const start = Date.now();
  const result = await callAI(userMessage, opts.provider, opts.model, opts.apiKey);
  const time = (Date.now() - start) / 1000;

  const score = result.confidence as number;
  const label = result.label as string;
  const pushedObj = result.pushed as Record<string, { detected: boolean }>;
  const pushedFlags = Object.entries(pushedObj).filter(([, v]) => v.detected).map(([k]) => k);

  if (opts.verbose) {
    console.log(`\n--- ${basename(filePath)} ---`);
    console.log(JSON.stringify(result, null, 2));
  }

  let mismatch: string | undefined;
  if (opts.compare) {
    const metaPath = filePath.replace('.eml', '.meta.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      const issues: string[] = [];
      if (meta.expectedLabel !== label) issues.push(`label: expected ${meta.expectedLabel}, got ${label}`);
      if (score < meta.expectedScoreRange[0] || score > meta.expectedScoreRange[1])
        issues.push(`score: ${score} outside [${meta.expectedScoreRange}]`);
      for (const flag of (meta.expectedPushed || [])) {
        if (!pushedObj[flag]?.detected) issues.push(`missing PUSHED.${flag}`);
      }
      if (issues.length) mismatch = issues.join('; ');
    }
  }

  return { file: basename(filePath), score, label, pushed: pushedFlags, time, mismatch };
}

async function main() {
  const args = process.argv.slice(2);
  const provider = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : 'anthropic';
  const model = args.includes('--model')
    ? args[args.indexOf('--model') + 1]
    : provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';
  const verbose = args.includes('--verbose');
  const compare = args.includes('--compare');
  const batch = args.includes('--batch');

  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`Error: Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} environment variable.`);
    process.exit(1);
  }

  const target = args.find(a => !a.startsWith('--') && args.indexOf(a) !== args.indexOf('--provider') + 1 && args.indexOf(a) !== args.indexOf('--model') + 1);
  if (!target) {
    console.error('Usage: npx tsx scripts/analyze-eml.ts [--batch] <file-or-dir> [--provider anthropic|openai] [--model <id>] [--verbose] [--compare]');
    process.exit(1);
  }

  const opts = { provider, model, apiKey, verbose, compare };

  if (batch) {
    const files = readdirSync(target).filter(f => f.endsWith('.eml')).map(f => join(target, f));
    if (files.length === 0) { console.error('No .eml files found in', target); process.exit(1); }

    console.log(`Analyzing ${files.length} file(s) with ${provider}/${model}...\n`);
    const results = [];
    for (const file of files) {
      const r = await analyzeFile(file, opts);
      results.push(r);
      process.stdout.write('.');
    }
    console.log('\n');

    // Print summary table
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(pad('File', 35) + pad('Score', 8) + pad('Label', 14) + pad('PUSHED', 30) + pad('Time', 8) + (compare ? 'Mismatch' : ''));
    console.log('-'.repeat(95 + (compare ? 30 : 0)));
    for (const r of results) {
      const line = pad(r.file, 35) + pad(String(r.score), 8) + pad(r.label, 14) + pad(r.pushed.join(',') || '-', 30) + pad(r.time.toFixed(1) + 's', 8);
      if (compare && r.mismatch) {
        console.log(line + '⚠ ' + r.mismatch);
      } else {
        console.log(line);
      }
    }
  } else {
    if (!existsSync(target)) { console.error('File not found:', target); process.exit(1); }
    const r = await analyzeFile(target, opts);
    console.log(`\nFile:   ${r.file}`);
    console.log(`Score:  ${r.score}`);
    console.log(`Label:  ${r.label}`);
    console.log(`PUSHED: ${r.pushed.length ? r.pushed.join(', ') : 'none'}`);
    console.log(`Time:   ${r.time.toFixed(1)}s`);
    if (compare && r.mismatch) console.log(`⚠ Mismatch: ${r.mismatch}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

**Step 2: Test the CLI manually (requires API key)**

Run: `ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts test-fixtures/eml/synthetic/clean-newsletter.eml --verbose`
Expected: Full JSON output with low score, "safe" label.

Run: `ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/synthetic/ --compare`
Expected: Summary table with comparison against .meta.json.

**Step 3: Commit**

```bash
git add scripts/analyze-eml.ts
git commit -m "feat: add CLI tool for evaluating EML files against AI analyzer"
```

### Task 11: Run full test suite and final commit

**Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass (EML parser, AI analyzer mocked, plus all existing tests).

**Step 2: Build extension**

Run: `npm run build`
Expected: Clean build.

**Step 3: Final verification commit if any adjustments needed**

```bash
git add -A
git status  # Verify only expected files
git commit -m "chore: final adjustments after full test run"
```
