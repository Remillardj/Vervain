# Batch Evaluation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `scripts/analyze-eml.ts` to handle 6000+ email corpora with parallel API calls, disk caching, resumability, manifest-based ground truth, and full statistical reporting.

**Architecture:** Single-file CLI enhancement. New code is added in sections: manifest parsing, cache layer, concurrent work queue, and stats computation. The existing single-file and small-batch paths stay intact.

**Tech Stack:** Node.js, `fs`/`path`/`crypto` (stdlib only — no new deps). Existing `parseEml` and `buildUserMessage` imports unchanged.

---

### Task 1: Manifest CSV Parser

**Files:**
- Modify: `scripts/analyze-eml.ts`

**Step 1: Write the manifest parser function**

Add after the existing `callAI` function (~line 70). This parses a CSV file where the first row is headers and subsequent rows map files to expected labels.

```typescript
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
```

**Step 2: Add `--manifest` flag to `parseArgs`**

Update the `parseArgs` return type and switch:

```typescript
// Add to return type:
manifest: string | null;

// Add to variables:
let manifest: string | null = null;

// Add case:
case '--manifest': manifest = args[++i]; break;

// Add to return:
return { provider, model, verbose, compare, batch, manifest, target };
```

**Step 3: Test manually**

Create a tiny `test-fixtures/eml/test-manifest.csv`:
```csv
file,expected_label
synthetic/clean-newsletter.eml,safe
synthetic/homograph-sender.eml,suspicious
```

Run: `npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/ --manifest test-fixtures/eml/test-manifest.csv --verbose`

Verify it parses without error (the manifest isn't wired into analysis yet — that comes in Task 4).

**Step 4: Commit**

```bash
git add scripts/analyze-eml.ts test-fixtures/eml/test-manifest.csv
git commit -m "feat(eval): add manifest CSV parser and --manifest flag"
```

---

### Task 2: Cache Layer

**Files:**
- Modify: `scripts/analyze-eml.ts`

**Step 1: Add crypto import and prompt hash helper**

At the top of the file, add `createHash` to the imports:

```typescript
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename, resolve, relative } from 'path';
import { createHash } from 'crypto';
```

Add after the manifest parser:

```typescript
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
```

**Step 2: Add `--no-cache` flag to `parseArgs`**

```typescript
// Add to return type:
noCache: boolean;

// Add to variables:
let noCache = false;

// Add case:
case '--no-cache': noCache = true; break;

// Add to return:
return { provider, model, verbose, compare, batch, manifest, noCache, target };
```

**Step 3: Wire cache into `analyzeFile`**

Add `batchDir` and `noCache` to the opts parameter. Before calling `callAI`, check cache. After calling, write cache:

```typescript
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
      for (const v of verifyArr) verify[v.flag] = v.status;
      // mismatch check omitted here — handled in Task 4
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
```

**Step 4: Test cache round-trip**

Run against a single synthetic file twice:
```bash
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/synthetic/ --verbose
# Second run should be near-instant (cached)
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/synthetic/ --verbose
```

Verify `.vervain-cache/` directory created with JSON files.

**Step 5: Add `.vervain-cache` to `.gitignore`**

```
.vervain-cache/
```

**Step 6: Commit**

```bash
git add scripts/analyze-eml.ts .gitignore
git commit -m "feat(eval): add disk cache with prompt-hash invalidation"
```

---

### Task 3: Concurrent Work Queue with Progress

**Files:**
- Modify: `scripts/analyze-eml.ts`

**Step 1: Add file discovery that walks subdirectories**

Replace the flat `readdirSync` in the batch path with recursive discovery:

```typescript
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
```

**Step 2: Add progress bar and concurrent runner**

```typescript
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
```

**Step 3: Add `--concurrency` flag to `parseArgs`**

```typescript
// Add to return type:
concurrency: number;

// Add to variables:
let concurrency = 5;

// Add case:
case '--concurrency': concurrency = parseInt(args[++i], 10); break;

// Add to return:
return { provider, model, verbose, compare, batch, manifest, noCache, concurrency, target };
```

**Step 4: Rewire `main()` batch path to use `runBatch`**

Replace the existing batch block in `main()`:

```typescript
if (batch) {
  const files = findEmlFiles(resolvedTarget);
  if (!files.length) { console.error('No .eml files found in', resolvedTarget); process.exit(1); }

  const results = await runBatch(files, {
    provider, model, apiKey, verbose, compare,
    batchDir: resolvedTarget, noCache, concurrency,
  });

  // Summary table (for small batches without manifest)
  if (!manifest && results.length <= 100) {
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log('\n' + pad('File', 45) + pad('Score', 8) + pad('Label', 14) + pad('PUSHED', 30) + pad('Time', 8) + (compare ? 'Mismatch' : ''));
    console.log('-'.repeat(105 + (compare ? 30 : 0)));
    for (const r of results) {
      if (r.error) { console.log(pad(r.file, 45) + 'ERROR: ' + r.error); continue; }
      const line = pad(r.file, 45) + pad(String(r.score), 8) + pad(r.label, 14) + pad(r.pushed.join(', ') || '-', 30) + pad(r.time.toFixed(1) + 's', 8);
      console.log(compare && r.mismatch ? line + ' !! ' + r.mismatch : line);
    }
  }
}
```

**Step 5: Test with synthetic fixtures**

```bash
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/ --concurrency 3
```

Verify progress bar renders, subdirectories are walked, and `.vervain-cache` files appear.

**Step 6: Commit**

```bash
git add scripts/analyze-eml.ts
git commit -m "feat(eval): add concurrent work queue with progress bar and resumability"
```

---

### Task 4: Statistical Report — Manifest Comparison + Classification Metrics

**Files:**
- Modify: `scripts/analyze-eml.ts`

**Step 1: Add manifest comparison to `runBatch` results**

After `runBatch` returns, apply manifest expectations to each result:

```typescript
function applyManifest(results: AnalysisResult[], manifest: Map<string, ManifestEntry>): void {
  for (const r of results) {
    if (r.error) continue;
    const entry = manifest.get(r.file);
    if (!entry) continue;
    const issues: string[] = [];
    if (entry.expectedLabel !== r.label) issues.push(`label: expected ${entry.expectedLabel}, got ${r.label}`);
    if (entry.expectedScoreMin !== undefined && r.score < entry.expectedScoreMin)
      issues.push(`score ${r.score} < min ${entry.expectedScoreMin}`);
    if (entry.expectedScoreMax !== undefined && r.score > entry.expectedScoreMax)
      issues.push(`score ${r.score} > max ${entry.expectedScoreMax}`);
    if (entry.expectedPushed) {
      for (const flag of entry.expectedPushed) {
        if (!r.pushed.includes(flag)) issues.push(`missing PUSHED.${flag}`);
      }
    }
    if (issues.length) r.mismatch = issues.join('; ');
  }
}
```

**Step 2: Add classification metrics**

```typescript
interface EvalStats {
  total: number;
  errors: number;
  classification: {
    confusionMatrix: Record<string, Record<string, number>>;
    binaryAccuracy: number;
    precision: number;
    recall: number;
    f1: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
  thresholds: Array<{ threshold: number; tpr: number; fpr: number; f1: number }>;
  pushedFlags: Record<string, { phishing: number; legitimate: number; phishingTotal: number; legitTotal: number }>;
  verifyFlags: Record<string, { phishing: number; legitimate: number; phishingTotal: number; legitTotal: number }>;
  latency: { p50: number; p90: number; p99: number };
  apiCalls: number;
  cachedHits: number;
  estimatedCost: number;
}

function computeStats(
  results: AnalysisResult[],
  manifest: Map<string, ManifestEntry>,
  model: string
): EvalStats {
  const valid = results.filter(r => !r.error);
  const withTruth = valid.filter(r => manifest.has(r.file));

  // Confusion matrix (3-class)
  const labels = ['safe', 'caution', 'suspicious'];
  const matrix: Record<string, Record<string, number>> = {};
  for (const actual of labels) {
    matrix[actual] = {};
    for (const pred of labels) matrix[actual][pred] = 0;
  }

  for (const r of withTruth) {
    const entry = manifest.get(r.file)!;
    const actual = entry.expectedLabel;
    const pred = r.label;
    if (matrix[actual] && matrix[actual][pred] !== undefined) {
      matrix[actual][pred]++;
    }
  }

  // Binary: safe = "clean", caution+suspicious = "flagged"
  // Ground truth: safe = negative, suspicious = positive
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of withTruth) {
    const entry = manifest.get(r.file)!;
    const actualPositive = entry.expectedLabel === 'suspicious';
    const predPositive = r.label !== 'safe';
    if (actualPositive && predPositive) tp++;
    else if (!actualPositive && predPositive) fp++;
    else if (!actualPositive && !predPositive) tn++;
    else fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const binaryAccuracy = withTruth.length > 0 ? (tp + tn) / withTruth.length : 0;
  const falsePositiveRate = tn + fp > 0 ? fp / (tn + fp) : 0;
  const falseNegativeRate = tp + fn > 0 ? fn / (tp + fn) : 0;

  // Threshold sweep
  const thresholds: EvalStats['thresholds'] = [];
  for (let t = 0; t <= 100; t += 5) {
    let tTp = 0, tFp = 0, tTn = 0, tFn = 0;
    for (const r of withTruth) {
      const entry = manifest.get(r.file)!;
      const actualPositive = entry.expectedLabel === 'suspicious';
      const predPositive = r.score >= t;
      if (actualPositive && predPositive) tTp++;
      else if (!actualPositive && predPositive) tFp++;
      else if (!actualPositive && !predPositive) tTn++;
      else tFn++;
    }
    const tTpr = tTp + tFn > 0 ? tTp / (tTp + tFn) : 0;
    const tFpr = tTn + tFp > 0 ? tFp / (tTn + tFp) : 0;
    const tPrec = tTp + tFp > 0 ? tTp / (tTp + tFp) : 0;
    const tF1 = tPrec + tTpr > 0 ? 2 * tPrec * tTpr / (tPrec + tTpr) : 0;
    thresholds.push({ threshold: t, tpr: tTpr, fpr: tFpr, f1: tF1 });
  }

  // Per-flag breakdown
  const pushedNames = ['pressure', 'urgency', 'surprise', 'highStakes', 'excitement', 'desperation'];
  const verifyNames = ['view', 'evaluate', 'request', 'interrogate', 'freeze', 'instincts'];

  const pushedFlags: EvalStats['pushedFlags'] = {};
  const verifyFlags: EvalStats['verifyFlags'] = {};

  const phishingResults = withTruth.filter(r => manifest.get(r.file)!.expectedLabel === 'suspicious');
  const legitResults = withTruth.filter(r => manifest.get(r.file)!.expectedLabel === 'safe');

  for (const flag of pushedNames) {
    pushedFlags[flag] = {
      phishing: phishingResults.filter(r => r.pushed.includes(flag)).length,
      legitimate: legitResults.filter(r => r.pushed.includes(flag)).length,
      phishingTotal: phishingResults.length,
      legitTotal: legitResults.length,
    };
  }
  for (const flag of verifyNames) {
    verifyFlags[flag] = {
      phishing: phishingResults.filter(r => r.verify[flag] === 'warning').length,
      legitimate: legitResults.filter(r => r.verify[flag] === 'warning').length,
      phishingTotal: phishingResults.length,
      legitTotal: legitResults.length,
    };
  }

  // Latency percentiles (non-cached only)
  const times = valid.filter(r => !r.cached).map(r => r.time).sort((a, b) => a - b);
  const pctl = (arr: number[], p: number) => arr.length ? arr[Math.min(Math.floor(arr.length * p), arr.length - 1)] : 0;

  // Cost estimate (rough)
  const costPerCall = model.includes('haiku') ? 0.001 : model.includes('sonnet') ? 0.01 : model.includes('gpt-4o-mini') ? 0.001 : 0.005;
  const apiCalls = valid.filter(r => !r.cached).length;

  return {
    total: results.length,
    errors: results.filter(r => r.error).length,
    classification: { confusionMatrix: matrix, binaryAccuracy, precision, recall, f1, falsePositiveRate, falseNegativeRate },
    thresholds,
    pushedFlags,
    verifyFlags,
    latency: { p50: pctl(times, 0.5), p90: pctl(times, 0.9), p99: pctl(times, 0.99) },
    apiCalls,
    cachedHits: valid.filter(r => r.cached).length,
    estimatedCost: apiCalls * costPerCall,
  };
}
```

**Step 3: Test the stats computation**

This is pure computation — verify by running against the 5 synthetic fixtures with the test manifest from Task 1:

```bash
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/ --manifest test-fixtures/eml/test-manifest.csv
```

**Step 4: Commit**

```bash
git add scripts/analyze-eml.ts
git commit -m "feat(eval): add manifest comparison and classification metrics"
```

---

### Task 5: Report Formatting and Output

**Files:**
- Modify: `scripts/analyze-eml.ts`

**Step 1: Add `--report` flag to `parseArgs`**

```typescript
// Add to return type:
report: string | null;

// Add to variables:
let report: string | null = null;

// Add case:
case '--report': report = args[++i]; break;

// Add to return:
return { provider, model, verbose, compare, batch, manifest, noCache, concurrency, report, target };
```

**Step 2: Add formatted terminal report printer**

```typescript
function printReport(stats: EvalStats): void {
  const pct = (n: number) => (n * 100).toFixed(1) + '%';
  const pad = (s: string, n: number) => s.padEnd(n);

  // Classification
  console.log('\n=== Classification ===\n');
  console.log('Confusion Matrix:');
  console.log(pad('', 20) + pad('Pred safe', 14) + pad('Pred caution', 14) + 'Pred suspicious');
  console.log('-'.repeat(62));
  for (const actual of ['safe', 'suspicious']) {
    const row = stats.classification.confusionMatrix[actual] || {};
    console.log(
      pad(`Actual ${actual}`, 20) +
      pad(String(row['safe'] || 0), 14) +
      pad(String(row['caution'] || 0), 14) +
      String(row['suspicious'] || 0)
    );
  }
  console.log();
  console.log(`Accuracy:  ${pct(stats.classification.binaryAccuracy)}`);
  console.log(`Precision: ${pct(stats.classification.precision)}`);
  console.log(`Recall:    ${pct(stats.classification.recall)}`);
  console.log(`F1:        ${pct(stats.classification.f1)}`);
  console.log(`FP Rate:   ${pct(stats.classification.falsePositiveRate)}`);
  console.log(`FN Rate:   ${pct(stats.classification.falseNegativeRate)}`);

  // Threshold analysis
  console.log('\n=== Threshold Analysis ===\n');
  console.log(pad('Threshold', 12) + pad('TPR', 10) + pad('FPR', 10) + 'F1');
  console.log('-'.repeat(42));
  let bestF1 = 0, bestT = 0;
  for (const t of stats.thresholds) {
    if (t.f1 > bestF1) { bestF1 = t.f1; bestT = t.threshold; }
  }
  for (const t of stats.thresholds) {
    const marker = t.threshold === bestT ? ' *' : '';
    console.log(pad(String(t.threshold), 12) + pad(pct(t.tpr), 10) + pad(pct(t.fpr), 10) + pct(t.f1) + marker);
  }
  console.log(`\n* Best F1 at threshold ${bestT}`);

  // Per-flag breakdown
  console.log('\n=== PUSHED Flags (% detected) ===\n');
  console.log(pad('Flag', 16) + pad('Phishing', 12) + 'Legitimate');
  console.log('-'.repeat(38));
  for (const [flag, data] of Object.entries(stats.pushedFlags)) {
    const phishPct = data.phishingTotal > 0 ? pct(data.phishing / data.phishingTotal) : 'N/A';
    const legitPct = data.legitTotal > 0 ? pct(data.legitimate / data.legitTotal) : 'N/A';
    console.log(pad(flag, 16) + pad(phishPct, 12) + legitPct);
  }

  console.log('\n=== VERIFY Flags (% warning) ===\n');
  console.log(pad('Flag', 16) + pad('Phishing', 12) + 'Legitimate');
  console.log('-'.repeat(38));
  for (const [flag, data] of Object.entries(stats.verifyFlags)) {
    const phishPct = data.phishingTotal > 0 ? pct(data.phishing / data.phishingTotal) : 'N/A';
    const legitPct = data.legitTotal > 0 ? pct(data.legitimate / data.legitTotal) : 'N/A';
    console.log(pad(flag, 16) + pad(phishPct, 12) + legitPct);
  }

  // Operational
  console.log('\n=== Operational ===\n');
  console.log(`Latency: p50=${stats.latency.p50.toFixed(2)}s  p90=${stats.latency.p90.toFixed(2)}s  p99=${stats.latency.p99.toFixed(2)}s`);
  console.log(`API calls: ${stats.apiCalls}  |  Cached: ${stats.cachedHits}  |  Errors: ${stats.errors}`);
  console.log(`Estimated cost: $${stats.estimatedCost.toFixed(2)}`);
}
```

**Step 3: Wire everything together in `main()`**

Update the batch path in `main()` to call stats + report after `runBatch`:

```typescript
if (batch) {
  const files = findEmlFiles(resolvedTarget);
  if (!files.length) { console.error('No .eml files found in', resolvedTarget); process.exit(1); }

  const results = await runBatch(files, {
    provider, model, apiKey, verbose, compare,
    batchDir: resolvedTarget, noCache, concurrency,
  });

  if (manifest) {
    const manifestMap = parseManifest(resolve(manifest));
    applyManifest(results, manifestMap);
    const stats = computeStats(results, manifestMap, model);
    printReport(stats);

    if (report) {
      const reportDir = resolve(report).split('/').slice(0, -1).join('/');
      if (reportDir) mkdirSync(reportDir, { recursive: true });
      writeFileSync(resolve(report), JSON.stringify({ stats, results }, null, 2));
      console.log(`\nFull report saved to ${report}`);
    }
  } else if (results.length <= 100) {
    // Small batch without manifest — show summary table (existing behavior)
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log('\n' + pad('File', 45) + pad('Score', 8) + pad('Label', 14) + pad('PUSHED', 30) + pad('Time', 8) + (compare ? 'Mismatch' : ''));
    console.log('-'.repeat(105 + (compare ? 30 : 0)));
    for (const r of results) {
      if (r.error) { console.log(pad(r.file, 45) + 'ERROR: ' + r.error); continue; }
      const line = pad(r.file, 45) + pad(String(r.score), 8) + pad(r.label, 14) + pad(r.pushed.join(', ') || '-', 30) + pad(r.time.toFixed(1) + 's', 8);
      console.log(compare && r.mismatch ? line + ' !! ' + r.mismatch : line);
    }
  }
}
```

**Step 4: Test end-to-end with synthetic fixtures**

```bash
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts \
  --batch test-fixtures/eml/ \
  --manifest test-fixtures/eml/test-manifest.csv \
  --report /tmp/test-report.json
```

Verify: progress bar, classification stats printed, JSON report written to `/tmp/test-report.json`.

**Step 5: Commit**

```bash
git add scripts/analyze-eml.ts
git commit -m "feat(eval): add formatted stats report and --report JSON output"
```

---

### Task 6: Update CLAUDE.md and Header Comment

**Files:**
- Modify: `CLAUDE.md`
- Modify: `scripts/analyze-eml.ts` (header comment only)

**Step 1: Update the script header comment**

Replace lines 1-16 of `scripts/analyze-eml.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * CLI tool to analyze .eml files through Vervain's AI analyzer.
 *
 * Single file:
 *   npx tsx scripts/analyze-eml.ts <file.eml>
 *
 * Small batch:
 *   npx tsx scripts/analyze-eml.ts --batch <directory>
 *
 * Large evaluation with stats:
 *   npx tsx scripts/analyze-eml.ts --batch <dir> --manifest <csv> --concurrency 10 --report out.json
 *
 * Flags:
 *   --provider anthropic|openai   (default: anthropic)
 *   --model <model-id>            (default: provider's cheapest)
 *   --verbose                     Show full JSON response
 *   --compare                     Compare against .meta.json expectations
 *   --manifest <csv>              CSV with file,expected_label columns
 *   --concurrency <N>             Parallel API calls (default: 5)
 *   --report <path>               Save full results + stats as JSON
 *   --no-cache                    Ignore cached results
 *
 * Requires ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.
 */
```

**Step 2: Add Batch Evaluation section to CLAUDE.md**

Insert after the existing "AI Analyzer CLI" section (after line 43):

```markdown
### Batch Evaluation

Run the AI analyzer against large email corpora with statistical reporting:

```bash
# Full evaluation with manifest and report
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts \
  --batch test-fixtures/eml/ \
  --manifest test-fixtures/eml/manifest.csv \
  --concurrency 10 \
  --report results/run.json

# Resume an interrupted run (cached results reused automatically)
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts \
  --batch test-fixtures/eml/ --manifest manifest.csv

# Force re-analyze, ignoring cache
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts \
  --batch test-fixtures/eml/ --manifest manifest.csv --no-cache

# OpenAI provider
OPENAI_API_KEY=<key> npx tsx scripts/analyze-eml.ts \
  --batch test-fixtures/eml/ --manifest manifest.csv --provider openai
```

**Manifest CSV** maps files to expected labels (`file` relative to batch dir):

```csv
file,expected_label
phishing/paypal-reset.eml,suspicious
legitimate/github-notification.eml,safe
```

Optional columns: `expected_score_min`, `expected_score_max`, `expected_pushed`.

Cache lives in `<batch-dir>/.vervain-cache/<model>_<prompt-hash>/` and auto-invalidates on prompt changes.

Report includes: confusion matrix, precision/recall/F1, threshold sweep, per-flag breakdown, latency percentiles, and cost estimate.
```

**Step 3: Commit**

```bash
git add scripts/analyze-eml.ts CLAUDE.md
git commit -m "docs: add batch evaluation usage to CLI header and CLAUDE.md"
```

---

### Task 7: Verify and clean up

**Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors.

**Step 2: Run existing tests**

```bash
npm run test
```

All existing tests must still pass. The new code is CLI-only — no unit tests needed beyond the existing `aiAnalyzer.test.ts` fixture integrity tests.

**Step 3: Manual smoke test**

```bash
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/ --manifest test-fixtures/eml/test-manifest.csv --concurrency 3 --report /tmp/smoke.json --verbose
```

Verify:
- Progress bar renders and completes
- Stats printed with all 4 sections
- `/tmp/smoke.json` contains `stats` and `results` keys
- Second run is near-instant (all cached)
- `--no-cache` forces re-analysis

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: lint and cleanup batch evaluation"
```
