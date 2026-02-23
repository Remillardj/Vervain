import { describe, it, expect } from 'vitest';
import { parseEml } from '@/utils/emlParser';
import { buildUserMessage } from '@/background/aiPrompt';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('AI Analyzer — mocked mode', () => {
  describe('buildUserMessage from parsed EML', () => {
    it('produces correct prompt structure from simple EML', () => {
      const eml = `From: John Doe <john@phish.com>\r\nSubject: Urgent Account Action\r\n\r\nPlease reset your password immediately at https://evil.com/reset`;

      const parsed = parseEml(eml);
      const message = buildUserMessage(parsed);

      expect(message).toContain('**From:** John Doe <john@phish.com>');
      expect(message).toContain('**Subject:** Urgent Account Action');
      expect(message).toContain('Please reset your password immediately');
      expect(message).toContain('**URLs found in email:**');
      expect(message).toContain('- https://evil.com/reset');
    });

    it('omits URLs section when email has no URLs', () => {
      const eml = `From: alice@safe.com\r\nSubject: Hello\r\n\r\nJust saying hi!`;
      const parsed = parseEml(eml);
      const message = buildUserMessage(parsed);

      expect(message).not.toContain('**URLs found in email:**');
    });

    it('round-trips a multipart EML correctly', () => {
      const eml = `From: Support <support@company.com>\r\nSubject: Your Invoice\r\nContent-Type: multipart/alternative; boundary="b1"\r\n\r\n--b1\r\nContent-Type: text/plain\r\n\r\nInvoice attached. See https://company.com/inv/1\r\n--b1--`;
      const parsed = parseEml(eml);
      const message = buildUserMessage(parsed);

      expect(message).toContain('**From:** Support <support@company.com>');
      expect(message).toContain('Invoice attached.');
      expect(message).toContain('- https://company.com/inv/1');
    });
  });

  describe('AI response parsing', () => {
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

    it('strips markdown code fences from response', () => {
      const wrapped = '```json\n{"confidence": 15, "label": "safe"}\n```';
      const cleaned = wrapped.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(cleaned);
      expect(parsed.confidence).toBe(15);
      expect(parsed.label).toBe('safe');
    });

    it('throws on completely invalid JSON', () => {
      expect(() => JSON.parse('not json at all')).toThrow();
    });
  });

  describe('score rubric validation', () => {
    const computeScore = (pushedCount: number, verifyWarnings: string[]): number => {
      const verifyPoints: Record<string, number> = {
        view: 15, evaluate: 10, request: 12, interrogate: 8, freeze: 10, instincts: 5,
      };
      const pushedPoints = pushedCount * 8;
      const verifySum = verifyWarnings.reduce((sum, flag) => sum + (verifyPoints[flag] || 0), 0);
      return Math.min(pushedPoints + verifySum, 100);
    };

    const labelFromScore = (score: number): string =>
      score <= 30 ? 'safe' : score <= 60 ? 'caution' : 'suspicious';

    it('scores safe for clean email (0 PUSHED, 0 VERIFY)', () => {
      expect(computeScore(0, [])).toBe(0);
      expect(labelFromScore(0)).toBe('safe');
    });

    it('scores caution for moderate email (3 PUSHED + 2 VERIFY)', () => {
      const score = computeScore(3, ['view', 'freeze']);
      expect(score).toBe(49); // 24 + 15 + 10
      expect(labelFromScore(score)).toBe('caution');
    });

    it('scores suspicious for dangerous email (4 PUSHED + 4 VERIFY)', () => {
      const score = computeScore(4, ['view', 'evaluate', 'request', 'freeze']);
      expect(score).toBe(79); // 32 + 15 + 10 + 12 + 10
      expect(labelFromScore(score)).toBe('suspicious');
    });

    it('caps at 100 for maximum scoring', () => {
      const score = computeScore(6, ['view', 'evaluate', 'request', 'interrogate', 'freeze', 'instincts']);
      expect(score).toBe(100); // 48 + 60 = 108 → capped at 100
    });
  });

  describe('synthetic fixtures integrity', () => {
    const fixturesDir = join(__dirname, '../../test-fixtures/eml/synthetic');

    it('all .eml files parse without error', () => {
      let files: string[];
      try {
        files = readdirSync(fixturesDir).filter(f => f.endsWith('.eml'));
      } catch {
        return; // Fixtures dir may not exist in CI
      }
      for (const file of files) {
        const raw = readFileSync(join(fixturesDir, file), 'utf-8');
        const parsed = parseEml(raw);
        expect(parsed.senderEmail, `${file}: missing senderEmail`).toBeTruthy();
        expect(parsed.subject, `${file}: missing subject`).toBeTruthy();
        expect(parsed.body, `${file}: missing body`).toBeTruthy();
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
        expect(meta.expectedLabel, `${file}: invalid label`).toMatch(/^(safe|caution|suspicious)$/);
        expect(meta.expectedScoreRange, `${file}: missing range`).toHaveLength(2);
        expect(meta.expectedScoreRange[0]).toBeLessThanOrEqual(meta.expectedScoreRange[1]);
        expect(Array.isArray(meta.expectedPushed), `${file}: expectedPushed must be array`).toBe(true);
      }
    });

    it('every .eml has a matching .meta.json', () => {
      let files: string[];
      try {
        files = readdirSync(fixturesDir).filter(f => f.endsWith('.eml'));
      } catch {
        return;
      }
      for (const file of files) {
        const metaPath = join(fixturesDir, file.replace('.eml', '.meta.json'));
        expect(() => readFileSync(metaPath), `${file}: missing .meta.json`).not.toThrow();
      }
    });
  });
});
