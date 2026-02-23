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
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const data = await res.json() as { content: Array<{ text: string }> };
    let text = data.content[0].text.trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    return JSON.parse(text);
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
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
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
      expect(result.label, `${file}: expected label ${meta.expectedLabel}, got ${result.label}`).toBe(meta.expectedLabel);

      // Assert score in range
      const score = result.confidence as number;
      expect(score, `${file}: score ${score} below ${meta.expectedScoreRange[0]}`)
        .toBeGreaterThanOrEqual(meta.expectedScoreRange[0]);
      expect(score, `${file}: score ${score} above ${meta.expectedScoreRange[1]}`)
        .toBeLessThanOrEqual(meta.expectedScoreRange[1]);

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
