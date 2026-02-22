# Batch Evaluation for AI Analyzer

**Date:** 2026-02-22
**Status:** Approved

## Problem

Need to validate the AI phishing analyzer against 6000+ phishing emails and 1000+ legitimate emails with full statistical reporting, concurrency, caching, and resumability.

## Approach

Evolve the existing `scripts/analyze-eml.ts` CLI. No new scripts or dependencies — extend what's there.

## CLI Interface

New flags on top of existing ones (`--provider`, `--model`, `--verbose`, `--compare`):

| Flag | Default | Description |
|------|---------|-------------|
| `--manifest <csv>` | none (falls back to folder convention or `.meta.json`) | CSV mapping filename to expected label/score |
| `--concurrency <N>` | `5` | Max parallel API calls |
| `--report <path>` | stdout only | Save full results + stats to JSON |
| `--no-cache` | false | Ignore cached results, re-analyze everything |

### Manifest CSV Format

```csv
file,expected_label
phishing/nigerian-prince.eml,suspicious
legitimate/github-notification.eml,safe
```

Minimal columns: `file` (relative to batch dir), `expected_label` (safe/caution/suspicious). Optional: `expected_score_min`, `expected_score_max`, `expected_pushed` (comma-separated in quotes).

## Caching & Resumability

**Cache location:** `<batch-dir>/.vervain-cache/<model-id>/`

Filenames flattened: `phishing/nigerian-prince.eml` → `phishing--nigerian-prince.eml.json`.

Cache file contains raw AI response + metadata (timestamp, prompt hash). Prompt hash is derived from `AI_SYSTEM_PROMPT` so changes auto-invalidate cached results. `--no-cache` forces re-analysis.

Interrupted runs resume automatically — cached results are reused on the next invocation.

## Concurrency & Progress

Work queue with `--concurrency N` workers (default 5). Each worker pulls next uncached file, calls API, writes cache, updates progress.

Terminal output:
```
Analyzing 6247 files (1823 cached, 4424 remaining) with anthropic/claude-haiku-4-5-20251001...
[============================------] 4424/4424  |  87.3/s  |  ETA 0m12s

Done in 4m32s (4424 API calls, 1823 cached). Report: results/run-2026-02-22.json
```

Errors collected and reported at end, not interrupting the run.

## Statistical Report

Four sections computed after all files are processed:

### 4a. Classification

3-class confusion matrix (safe/caution/suspicious). Since ground truth is binary (safe vs suspicious), "caution" predictions are a gray zone. Headline binary metrics collapse caution+suspicious = "flagged" vs safe = "clean":

- Accuracy, Precision, Recall, F1 (for suspicious class)
- False positive rate (safe emails labeled suspicious)
- False negative rate (suspicious emails labeled safe)

### 4b. Threshold Analysis

Sweep score thresholds 0-100 in steps of 5. At each: TPR, FPR, F1 for binary classification "score >= threshold means phishing." Output as table to find optimal operating point.

### 4c. Per-Flag Breakdown

For each PUSHED flag (pressure, urgency, surprise, highStakes, excitement, desperation) and each VERIFY flag (view, evaluate, request, interrogate, freeze, instincts): percentage fired on phishing vs legitimate.

### 4d. Operational Stats

- Latency: p50, p90, p99
- Total API calls, cached hits
- Estimated cost (model pricing × rough token counts)
- Error count + list of failed files

### Output

Terminal gets formatted summary. `--report <path>` saves structured JSON with every raw result + all computed stats.

## Documentation

Add `### Batch Evaluation` section to CLAUDE.md after the existing AI Analyzer CLI section with usage examples.
