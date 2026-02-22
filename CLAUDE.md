# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vervain is a Chrome extension (Manifest v3) that protects users from phishing attacks by monitoring email domains and detecting suspicious variations in Gmail. It detects domain spoofing, homograph attacks, typosquatting, and trusted contact impersonation.

## Commands

- `npm run dev` — Start Vite dev server on port 8080
- `npm run build` — Production build to `dist/`
- `npm run build:dev` — Development build with source maps
- `npm run lint` — ESLint
- `npm run preview` — Preview the production build
- `npm run test` — Run Vitest test suite (`vitest run`, pattern `src/**/*.test.ts`)

To load in Chrome: build, then go to `chrome://extensions` → "Load unpacked" → select `dist/`.

### AI Analyzer CLI

Test `.eml` files against the AI phishing analyzer:

```bash
# Single file
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts <file.eml>

# Batch (all .eml files in a directory)
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch <directory>

# Compare results against .meta.json expectations
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts --batch test-fixtures/eml/synthetic/ --compare

# Full JSON output
ANTHROPIC_API_KEY=<key> npx tsx scripts/analyze-eml.ts <file.eml> --verbose
```

Flags: `--provider anthropic|openai`, `--model <id>`, `--verbose`, `--compare`, `--batch`.

Test fixtures live in `test-fixtures/eml/` — drop `.eml` files in `synthetic/`, `phishing/`, or `legitimate/`.

## Architecture

### Multi-Page Chrome Extension

The app has three HTML entry points, each with its own React root:

| Entry | HTML | React root | Purpose |
|-------|------|------------|---------|
| Main | `index.html` | `src/main.tsx` → `src/App.tsx` | Marketing/landing page (uses React Router) |
| Popup | `popup.html` | `src/popup.tsx` → `PopupApp.tsx` | Extension toolbar popup (400×400px) |
| Options | `options.html` | `src/options.tsx` → `OptionsPage.tsx` | Full settings page (5 tabs: General, Domains, Contacts, Known Threats, AI Analysis) |

Vite is configured with Rollup `input` for all three entry points. Popup and options JS files get stable names (`[name].js`), while main app assets are hashed.

### Chrome Extension Layer (plain JS, not bundled)

Files in `public/` are copied as-is to `dist/`:

- **`manifest.json`** — Manifest v3. Permissions: `storage`, `activeTab`, `scripting`. Host permission: `https://mail.google.com/*`
- **`background.js`** — Service worker. Handles install event, badge updates on phishing detection, and settings relay via message passing.
- **`contentScript.js`** — Injected into Gmail. This is the core detection engine (~1750 lines). Uses MutationObserver to scan emails as they load. Detection methods:
  - Domain similarity via Levenshtein distance (≤20% threshold)
  - Homograph normalization (basic + expanded character sets)
  - Hyphen/dot substitution attacks
  - Combo domain tricks (protected domain as subdomain)
  - Trusted contact spoofing (name-based matching across domains)
  - Caches settings in localStorage as fallback when extension context is invalidated

### Key Source Files

- **`src/utils/storage.ts`** — Wraps `chrome.storage.local` with Promise API; falls back to `localStorage` in dev. All data flows through `getData()`/`saveData()`. Defines `UserDomainData` and `TrustedContact` interfaces.
- **`src/utils/dnstwist.ts`** — Generates domain variations (typosquatting, homographs, bitsquatting, hyphenation, addition, subdomain, TLD swap) for the popup's precomputed variation list.
- **`src/utils/csvImport.ts`** — CSV parsing with validation for bulk contact/domain import.
- **`src/components/ui/`** — shadcn-ui components (Radix UI primitives + Tailwind). Configured via `components.json` with `@/components/ui` alias.

### Path Alias

`@/` maps to `./src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

### Styling

Tailwind CSS with class-based dark mode. Custom CSS variables for theme colors defined in `src/index.css`. The `cn()` utility from `src/lib/utils.ts` merges Tailwind classes via `clsx` + `tailwind-merge`.

### Data Flow

1. User configures domains/contacts via Popup (setup) or Options page
2. Settings are persisted to `chrome.storage.local` via `storage.ts`
3. Content script reads settings (with localStorage cache fallback) and scans Gmail DOM
4. Suspicious matches trigger in-page warnings and badge updates via message to background script

## Landing Page

`/landingpage/` contains a standalone static marketing page (separate from the React app in `index.html`). It has its own `styles.css` with custom fonts and animations.
