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

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename, resolve, relative } from 'path';
import { createHash } from 'crypto';
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

// --- Manifest ---

interface ManifestEntry {
  file: string;
  expectedLabel: string;
  expectedScoreMin?: number;
  expectedScoreMax?: number;
  expectedPushed?: string[];
}

function parseManifest(manifestPath: string): Map<string, ManifestEntry> {
  const raw = readFileSync(manifestPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());

  const fileIdx = header.indexOf('file');
  const labelIdx = header.indexOf('expected_label');
  const minIdx = header.indexOf('expected_score_min');
  const maxIdx = header.indexOf('expected_score_max');
  const pushedIdx = header.indexOf('expected_pushed');

  if (fileIdx === -1 || labelIdx === -1) {
    throw new Error('Manifest CSV must have "file" and "expected_label" columns');
  }

  const entries = new Map<string, ManifestEntry>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
    if (!cols[fileIdx]) continue;
    entries.set(cols[fileIdx], {
      file: cols[fileIdx],
      expectedLabel: cols[labelIdx],
      expectedScoreMin: minIdx !== -1 && cols[minIdx] ? Number(cols[minIdx]) : undefined,
      expectedScoreMax: maxIdx !== -1 && cols[maxIdx] ? Number(cols[maxIdx]) : undefined,
      expectedPushed: pushedIdx !== -1 && cols[pushedIdx] ? cols[pushedIdx].split(',').map(s => s.trim()) : undefined,
    });
  }
  return entries;
}

// --- Cache ---

function promptHash(): string {
  return createHash('sha256').update(AI_SYSTEM_PROMPT).digest('hex').slice(0, 12);
}

function cacheKey(filePath: string, batchDir: string): string {
  return relative(batchDir, filePath).replace(/[\\/]/g, '--');
}

function getCacheDir(batchDir: string, model: string): string {
  return join(batchDir, '.vervain-cache', `${model}_${promptHash()}`);
}

interface CachedResult {
  timestamp: string;
  model: string;
  promptHash: string;
  result: Record<string, unknown>;
  timeMs: number;
}

function readCache(cacheDir: string, key: string): CachedResult | null {
  const path = join(cacheDir, `${key}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeCache(cacheDir: string, key: string, data: CachedResult): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, `${key}.json`), JSON.stringify(data, null, 2));
}

// --- File Discovery ---

function findEmlFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory() && entry.name !== '.vervain-cache') walk(full);
      else if (entry.name.endsWith('.eml')) results.push(full);
    }
  }
  walk(dir);
  return results.sort();
}

// --- Analysis ---

async function analyzeFile(
  filePath: string,
  opts: {
    provider: string; model: string; apiKey: string;
    verbose: boolean; compare: boolean;
    batchDir?: string; noCache?: boolean;
  }
): Promise<{ file: string; score: number; label: string; pushed: string[]; verify: Record<string, string>; time: number; cached: boolean; mismatch?: string }> {
  const relFile = opts.batchDir ? relative(opts.batchDir, filePath) : basename(filePath);

  // Check cache
  if (opts.batchDir && !opts.noCache) {
    const cacheDir = getCacheDir(opts.batchDir, opts.model);
    const key = cacheKey(filePath, opts.batchDir);
    const cached = readCache(cacheDir, key);
    if (cached) {
      const result = cached.result;
      const score = result.confidence as number;
      const label = result.label as string;
      const pushedObj = result.pushed as Record<string, { detected: boolean }>;
      const pushedFlags = Object.entries(pushedObj).filter(([, v]) => v.detected).map(([k]) => k);
      const verifyArr = result.verify as Array<{ flag: string; status: string }>;
      const verify: Record<string, string> = {};
      for (const v of verifyArr || []) verify[v.flag] = v.status;
      return { file: relFile, score, label, pushed: pushedFlags, verify, time: cached.timeMs / 1000, cached: true };
    }
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseEml(raw);
  const userMessage = buildUserMessage(parsed);

  const start = Date.now();
  const result = await callAI(userMessage, opts.provider, opts.model, opts.apiKey);
  const timeMs = Date.now() - start;

  // Write cache
  if (opts.batchDir && !opts.noCache) {
    const cacheDir = getCacheDir(opts.batchDir, opts.model);
    const key = cacheKey(filePath, opts.batchDir);
    writeCache(cacheDir, key, {
      timestamp: new Date().toISOString(),
      model: opts.model,
      promptHash: promptHash(),
      result,
      timeMs,
    });
  }

  const score = result.confidence as number;
  const label = result.label as string;
  const pushedObj = result.pushed as Record<string, { detected: boolean }>;
  const pushedFlags = Object.entries(pushedObj).filter(([, v]) => v.detected).map(([k]) => k);
  const verifyArr = result.verify as Array<{ flag: string; status: string }>;
  const verify: Record<string, string> = {};
  for (const v of verifyArr || []) verify[v.flag] = v.status;

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

  return { file: relFile, score, label, pushed: pushedFlags, verify, time: timeMs / 1000, cached: false, mismatch };
}

// --- Batch Runner ---

function progressBar(done: number, total: number, width = 40): string {
  const pct = done / total;
  const filled = Math.round(pct * width);
  return '[' + '='.repeat(filled) + '-'.repeat(width - filled) + ']';
}

interface AnalysisResult {
  file: string; score: number; label: string;
  pushed: string[]; verify: Record<string, string>;
  time: number; cached: boolean; mismatch?: string;
  error?: string;
}

async function runBatch(
  files: string[],
  opts: {
    provider: string; model: string; apiKey: string;
    verbose: boolean; compare: boolean;
    batchDir: string; noCache: boolean; concurrency: number;
  }
): Promise<AnalysisResult[]> {
  const cacheDir = getCacheDir(opts.batchDir, opts.model);
  const total = files.length;
  let cachedCount = 0;

  // Pre-scan for cached files
  if (!opts.noCache) {
    for (const f of files) {
      const key = cacheKey(f, opts.batchDir);
      if (readCache(cacheDir, key)) cachedCount++;
    }
  }

  const remaining = opts.noCache ? total : total - cachedCount;
  console.log(`Analyzing ${total} files (${cachedCount} cached, ${remaining} remaining) with ${opts.provider}/${opts.model}...\n`);

  const results: AnalysisResult[] = new Array(total);
  let done = 0;
  const startTime = Date.now();
  const errors: { file: string; error: string }[] = [];

  function updateProgress() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done > 0 ? done / elapsed : 0;
    const eta = rate > 0 ? Math.ceil((total - done) / rate) : 0;
    const etaStr = eta > 60 ? `${Math.floor(eta / 60)}m${eta % 60}s` : `${eta}s`;
    process.stdout.write(`\r${progressBar(done, total)} ${done}/${total}  |  ${rate.toFixed(1)}/s  |  ETA ${etaStr}  `);
  }

  // Work queue with concurrency limit
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < total) {
      const idx = nextIdx++;
      const file = files[idx];
      try {
        const r = await analyzeFile(file, {
          ...opts,
          batchDir: opts.batchDir,
          noCache: opts.noCache,
        });
        results[idx] = r;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ file: relative(opts.batchDir, file), error: msg });
        results[idx] = {
          file: relative(opts.batchDir, file),
          score: -1, label: 'error', pushed: [], verify: {},
          time: 0, cached: false, error: msg,
        };
      }
      done++;
      updateProgress();
    }
  }

  const workers = Array.from({ length: opts.concurrency }, () => worker());
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const apiCalls = results.filter(r => !r.cached && !r.error).length;
  process.stdout.write('\n\n');
  console.log(`Done in ${elapsed}s (${apiCalls} API calls, ${cachedCount} cached, ${errors.length} errors).`);
  if (errors.length) {
    console.log(`\nErrors:`);
    for (const e of errors) console.log(`  ${e.file}: ${e.error}`);
  }

  return results;
}

// --- CLI ---

function parseArgs(args: string[]): {
  provider: string; model: string; verbose: boolean; compare: boolean; batch: boolean;
  manifest: string | null; noCache: boolean; concurrency: number; target: string | null;
} {
  let provider = 'anthropic';
  let model = '';
  let verbose = false;
  let compare = false;
  let batch = false;
  let manifest: string | null = null;
  let noCache = false;
  let concurrency = 5;
  let target: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider': provider = args[++i]; break;
      case '--model': model = args[++i]; break;
      case '--verbose': verbose = true; break;
      case '--compare': compare = true; break;
      case '--batch': batch = true; break;
      case '--manifest': manifest = args[++i]; break;
      case '--no-cache': noCache = true; break;
      case '--concurrency': concurrency = parseInt(args[++i], 10); break;
      default: if (!args[i].startsWith('--')) target = args[i]; break;
    }
  }

  if (!model) model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';
  return { provider, model, verbose, compare, batch, manifest, noCache, concurrency, target };
}

async function main() {
  const { provider, model, verbose, compare, batch, manifest, noCache, concurrency, target } = parseArgs(process.argv.slice(2));

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
    const files = findEmlFiles(resolvedTarget);
    if (!files.length) { console.error('No .eml files found in', resolvedTarget); process.exit(1); }

    const results = await runBatch(files, {
      provider, model, apiKey, verbose, compare,
      batchDir: resolvedTarget, noCache, concurrency,
    });

    // Summary table (for small batches without manifest)
    if (!manifest && results.length <= 100) {
      console.log('\n' + pad('File', 45) + pad('Score', 8) + pad('Label', 14) + pad('PUSHED', 30) + pad('Time', 8) + (compare ? 'Mismatch' : ''));
      console.log('-'.repeat(105 + (compare ? 30 : 0)));
      for (const r of results) {
        if (r.error) { console.log(pad(r.file, 45) + 'ERROR: ' + r.error); continue; }
        const line = pad(r.file, 45) + pad(String(r.score), 8) + pad(r.label, 14) + pad(r.pushed.join(', ') || '-', 30) + pad(r.time.toFixed(1) + 's', 8);
        console.log(compare && r.mismatch ? line + ' !! ' + r.mismatch : line);
      }
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
