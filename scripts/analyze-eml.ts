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
 *
 * Requires ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, resolve } from 'path';
import { parseEml } from '../src/utils/emlParser';
import { buildUserMessage, AI_SYSTEM_PROMPT } from '../src/background/aiPrompt';

// --- AI API calls ---

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
    const data = await res.json() as { content: Array<{ text: string }> };
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
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return JSON.parse(data.choices[0].message.content);
  }
}

// --- Analysis ---

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

// --- CLI ---

function parseArgs(args: string[]): {
  provider: string; model: string; verbose: boolean; compare: boolean; batch: boolean; target: string | null;
} {
  let provider = 'anthropic';
  let model = '';
  let verbose = false;
  let compare = false;
  let batch = false;
  let target: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider': provider = args[++i]; break;
      case '--model': model = args[++i]; break;
      case '--verbose': verbose = true; break;
      case '--compare': compare = true; break;
      case '--batch': batch = true; break;
      default: if (!args[i].startsWith('--')) target = args[i]; break;
    }
  }

  if (!model) model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';
  return { provider, model, verbose, compare, batch, target };
}

async function main() {
  const { provider, model, verbose, compare, batch, target } = parseArgs(process.argv.slice(2));

  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`Error: Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} environment variable.`);
    process.exit(1);
  }

  if (!target) {
    console.error('Usage: npx tsx scripts/analyze-eml.ts [--batch] <file-or-dir> [--provider anthropic|openai] [--model <id>] [--verbose] [--compare]');
    process.exit(1);
  }

  const resolvedTarget = resolve(target);
  const opts = { provider, model, apiKey, verbose, compare };
  const pad = (s: string, n: number) => s.padEnd(n);

  if (batch) {
    const files = readdirSync(resolvedTarget).filter(f => f.endsWith('.eml')).map(f => join(resolvedTarget, f));
    if (!files.length) { console.error('No .eml files found in', resolvedTarget); process.exit(1); }

    console.log(`Analyzing ${files.length} file(s) with ${provider}/${model}...\n`);
    const results = [];
    for (const file of files) {
      const r = await analyzeFile(file, opts);
      results.push(r);
      process.stdout.write('.');
    }
    console.log('\n');

    // Summary table
    console.log(pad('File', 35) + pad('Score', 8) + pad('Label', 14) + pad('PUSHED', 30) + pad('Time', 8) + (compare ? 'Mismatch' : ''));
    console.log('-'.repeat(95 + (compare ? 30 : 0)));
    for (const r of results) {
      const line = pad(r.file, 35) + pad(String(r.score), 8) + pad(r.label, 14) + pad(r.pushed.join(', ') || '-', 30) + pad(r.time.toFixed(1) + 's', 8);
      console.log(compare && r.mismatch ? line + ' !! ' + r.mismatch : line);
    }
  } else {
    if (!existsSync(resolvedTarget)) { console.error('File not found:', resolvedTarget); process.exit(1); }
    const r = await analyzeFile(resolvedTarget, opts);
    console.log(`\nFile:   ${r.file}`);
    console.log(`Score:  ${r.score}`);
    console.log(`Label:  ${r.label}`);
    console.log(`PUSHED: ${r.pushed.length ? r.pushed.join(', ') : 'none'}`);
    console.log(`Time:   ${r.time.toFixed(1)}s`);
    if (compare && r.mismatch) console.log(`\n!! Mismatch: ${r.mismatch}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
