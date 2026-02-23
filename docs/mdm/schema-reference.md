# Managed Schema Reference

Vervain supports enterprise deployment via Chrome's managed storage API. Administrators can push configuration through any MDM platform that supports Chrome extension policies.

When a setting is managed, users see a lock icon in the UI and cannot override it.

## Quick Start

Minimal enterprise configuration that protects key domains and enables all scanning:

```json
{
  "protectedDomains": ["yourcompany.com", "yourcompany.org"],
  "domainDetectionEnabled": true,
  "contactDetectionEnabled": true,
  "tiAutoScan": true,
  "enabledThreatFeeds": ["phishtank", "urlhaus", "threatfox", "openphish"]
}
```

---

## Domain Protection

### `protectedDomains`

| Property | Value |
|----------|-------|
| Type | `array` of `string` |
| Default | `[]` (empty) |
| Locks UI | Domain list in Domains tab |

Domains to monitor for phishing. Vervain detects typosquatting, homograph attacks, and other spoofing variations of these domains.

**Example:**
```json
"protectedDomains": ["acme.com", "acme.org", "acmeinc.com"]
```

### `domainDetectionEnabled`

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Locks UI | Domain detection toggle in General tab |

Master switch for domain similarity detection in the content script.

---

## Contact Protection

### `trustedContacts`

| Property | Value |
|----------|-------|
| Type | `array` of `{ name: string, email: string }` |
| Default | `[]` (empty) |
| Locks UI | Contact list in Contacts tab |

Known-good contacts. Vervain alerts when an email appears to be from a trusted contact but uses a different domain.

**Example:**
```json
"trustedContacts": [
  { "name": "Jane Smith", "email": "jane@acme.com" },
  { "name": "IT Support", "email": "support@acme.com" }
]
```

### `contactDetectionEnabled`

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |
| Locks UI | Contact detection toggle in General tab |

Master switch for trusted contact impersonation detection.

---

## Known Threats

### `tiAutoScan`

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `false` |
| Locks UI | "Auto-check known threat databases" toggle in General tab |

Automatically check every email's sender domain against enabled threat databases.

### `enabledThreatFeeds`

| Property | Value |
|----------|-------|
| Type | `array` of `string` |
| Default | `["phishtank", "urlhaus", "threatfox", "openphish"]` |
| Locks UI | Individual feed toggles in Known Threats tab |

Which threat databases to query. Valid values: `phishtank`, `urlhaus`, `threatfox`, `openphish`.

**Example:**
```json
"enabledThreatFeeds": ["phishtank", "urlhaus"]
```

### `virusTotalApiKey`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `""` (empty) |
| Locks UI | VirusTotal API key field in Known Threats tab |

VirusTotal API key for additional domain reputation scoring. Free tier: 4 requests/minute.

---

## AI Analysis

### `aiProvider`

| Property | Value |
|----------|-------|
| Type | `string` — `"anthropic"` or `"openai"` |
| Default | `"anthropic"` |
| Locks UI | Provider selector in AI Analysis tab |

Which AI provider to use for email analysis.

### `aiApiKey`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `""` (empty) |
| Locks UI | API key field in AI Analysis tab |

API key for the selected AI provider.

### `aiModel`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | Provider-dependent |
| Locks UI | Model selector in AI Analysis tab |

Specific model ID to use (e.g., `claude-haiku-4-5-20251001`, `gpt-4o-mini`).

### `aiAutoScan`

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `false` |
| Locks UI | "Auto AI scan" toggle in General tab |

Automatically run AI analysis on every email.

---

## Remote Configuration

These keys allow dynamic policy updates without MDM redeployment.

### `configUrl`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `""` (empty) |
| Locks UI | N/A (not exposed in UI) |

URL to fetch remote configuration JSON. Vervain periodically polls this endpoint and merges the response into local settings.

### `configAuthToken`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `""` (empty) |
| Locks UI | N/A |

Bearer token sent as `Authorization` header when fetching remote config.

### `configRefreshIntervalMinutes`

| Property | Value |
|----------|-------|
| Type | `integer` (minimum: 5) |
| Default | `60` |
| Locks UI | N/A |

How often (in minutes) to poll the remote config URL.
