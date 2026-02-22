# Design: UX Rename, MDM Docs, AI Analyzer Testing

**Date:** 2026-02-21
**Branch:** j--major

## Overview

Three related improvements to Vervain:

1. **Rename "Threat Intel" to "Known Threats"** — Replace jargon with user-friendly labels across the Options page UI
2. **MDM Deployment Documentation** — Schema reference + platform-specific deployment guides for Jamf, Intune, and Google Workspace
3. **AI Analyzer Testing** — EML parser, automated test suite (mocked + live), manual CLI evaluation tool, and test fixtures from public/self-collected/synthetic sources

---

## 1. Rename "Threat Intel" to "Known Threats Database"

### Motivation

End-users (primary audience) don't know what "threat intelligence" means. The UI needs to communicate value without security jargon.

### UI Label Changes

| Current | New | Location |
|---------|-----|----------|
| Tab: "Threat Intel" | **"Known Threats"** | TabsTrigger |
| Toggle: "Auto Threat Intel" | **"Auto-check known threat databases"** | General tab |
| Helper: "Automatically check threat feeds for every email" | **"Automatically check sender domains against databases of known phishing and malware sites"** | General tab |
| Toast: "Auto Threat Intel enabled/disabled" | **"Auto known-threats check enabled/disabled"** | handleToggleAutoTI |
| Card: "Threat Feed Sources" | **"Known Threat Sources"** | Known Threats tab |
| Card desc: "Enable or disable threat intelligence feeds for domain reputation checking" | **"Choose which databases Vervain checks for known phishing and malware domains"** | Known Threats tab |
| Card: "About Threat Intelligence" | **"How Known Threats Checking Works"** | Known Threats tab |

### Feed Descriptions

| Current | New |
|---------|-----|
| PhishTank: "Community-verified phishing URL database" | **"Community-verified phishing sites"** |
| URLhaus: "Malware URL database by abuse.ch" | **"Known malware distribution sites"** |
| ThreatFox: "IOC database by abuse.ch" | **"Indicators of compromise database"** |
| OpenPhish: "Automated phishing intelligence" | **"Automatically detected phishing sites"** |

### "About" Card Rewrite

Replace Bloom Filter / Feed Lookup jargon with:

> Vervain checks sender domains against multiple databases of known malicious sites:
> - **Quick check** — A fast lookup against all enabled databases (runs in milliseconds)
> - **Confirmation** — If a match is found, Vervain confirms it with the original source
> - **VirusTotal** — Additional reputation scoring and domain age analysis (optional)
>
> Databases refresh automatically in the background. All data is stored locally on your device.

### Scope

UI-only rename. Internal state variables (`autoTI`, `enabledThreatFeeds`, storage keys `tiAutoScan`) remain unchanged. No storage migration needed.

---

## 2. MDM Deployment Documentation

### File Structure

```
docs/
  mdm/
    schema-reference.md
    deploy-jamf.md
    deploy-intune.md
    deploy-google-workspace.md
```

### Schema Reference

Documents every key in `managed_schema.json`:
- Key name, type, default, whether it locks a UI toggle
- Description of what it controls
- Example value
- Grouped by category: Domain Protection, Contact Protection, Known Threats, AI Analysis, Remote Config

### Platform Guides (identical structure per platform)

1. Prerequisites
2. Install the extension (force-install via ExtensionInstallForcelist)
3. Configure managed settings (platform-specific mechanism)
4. Example configuration (copy-pasteable, common enterprise defaults)
5. Verify deployment (chrome://policy, lock icons in UI)
6. Troubleshooting

**Jamf Pro:** Chrome policy plist via Configuration Profiles, Custom Settings. Plist XML mapping to managed_schema keys.

**Microsoft Intune:** OMA-URI settings or ADMX ingestion. JSON payload format.

**Google Workspace:** Admin console, Devices, Chrome, Apps & extensions. Managed preferences JSON.

### Remote Config

Document `configUrl`, `configAuthToken`, `configRefreshIntervalMinutes` as the mechanism for dynamic policy updates without MDM redeployment.

---

## 3. AI Analyzer Testing

### EML Parser

New file: `src/utils/emlParser.ts`

Parses RFC 2822 `.eml` files, extracts:
- `senderName`, `senderEmail` (from `From:` header)
- `subject` (from `Subject:` header)
- `body` (text/plain, or stripped HTML fallback)
- `urls` (extracted from body)

Handles single-part text/plain, text/html, basic multipart/alternative. No attachment handling needed.

### Test Fixtures

```
test-fixtures/
  eml/
    phishing/
      README.md
    legitimate/
    synthetic/
      homograph-sender.eml
      urgency-tactics.eml
      brand-embedding.eml
      polite-predation.eml
      clean-newsletter.eml
```

Each `.eml` has a companion `.meta.json`:
```json
{
  "source": "nazario-corpus",
  "expectedLabel": "suspicious",
  "expectedScoreRange": [61, 100],
  "expectedPushed": ["urgency", "highStakes"],
  "description": "Fake bank account lockout with 24hr deadline"
}
```

### Automated Test Suite

`src/__tests__/aiAnalyzer.test.ts`

**Mocked mode (CI-safe, default):**
- Tests `buildUserMessage()` prompt construction from parsed EML
- Tests response parsing (valid JSON, malformed, edge cases)
- Tests score calculation matches rubric
- No API key or network calls

**Live mode (opt-in, local):**
- Gated: `VERVAIN_LIVE_AI_TESTS=1` + API key env var
- Real API calls against fixture EML files
- Asserts on ranges: label and score within `expectedScoreRange`
- Asserts expected PUSHED indicators fire (allows extras)

### CLI Evaluation Tool

`scripts/analyze-eml.ts` — run with `npx tsx scripts/analyze-eml.ts`

**Single file:**
```
npx tsx scripts/analyze-eml.ts test-fixtures/eml/phishing/sample1.eml
```

**Batch mode:**
```
npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/phishing/
```

Output summary table: File, Score, Label, PUSHED flags, Time.

**Flags:**
- `--provider anthropic|openai`
- `--model <model-id>`
- `--verbose` (full JSON)
- `--compare <meta>` (compare against .meta.json, highlight mismatches)

### EML Sources

**Public datasets:** Downloaded via `scripts/download-test-eml.sh`, gitignored. Metadata `.meta.json` committed.

**Self-collected:** Committed to `test-fixtures/eml/` (sanitized — recipient addresses redacted).

**Synthetic:** Hand-crafted `.eml` files targeting specific detection scenarios for regression testing.

### Out of Scope

- No changes to AI prompt or scoring rubric
- No content script or extension runtime changes
- No browser-based dev tool
