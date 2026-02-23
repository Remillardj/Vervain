# Deploying Vervain with Google Workspace

## Prerequisites

- Google Workspace admin access (Super Admin or delegated Chrome management)
- Chrome Browser Cloud Management enabled
- Target ChromeOS devices or managed Chrome browsers
- Vervain extension ID

## 1. Force-Install the Extension

1. **Google Admin console** → Devices → Chrome → Apps & extensions
2. Select the target OU (organizational unit) in the left sidebar
3. Click the **+** icon → **Add from Chrome Web Store**
4. Search for Vervain or enter the extension ID directly
5. Set Installation Policy to **Force install**
6. Save

## 2. Configure Managed Settings

1. Still in Apps & extensions, click on the Vervain entry
2. Scroll to **Policy for extensions** (or "Managed configuration")
3. Paste the JSON configuration:

### Example Configuration

```json
{
  "protectedDomains": ["yourcompany.com", "yourcompany.org"],
  "domainDetectionEnabled": true,
  "contactDetectionEnabled": true,
  "tiAutoScan": true,
  "enabledThreatFeeds": ["phishtank", "urlhaus", "threatfox", "openphish"],
  "aiProvider": "anthropic",
  "aiApiKey": "sk-ant-...",
  "aiAutoScan": true
}
```

4. Save

## 3. Verify Deployment

On a managed device:

1. Policy propagation can take up to 1 hour (force refresh: `chrome://policy` → "Reload policies")
2. At `chrome://policy`, search for the extension ID — managed keys should appear
3. Open Vervain Options page — managed settings show lock icons
4. Locked settings cannot be changed by end users

## 4. Organizational Unit Inheritance

- Policies set at a parent OU apply to all child OUs
- Child OUs can override parent policies
- To deploy different configs per department, create separate OUs and set distinct managed configurations for each

## 5. ChromeOS vs Managed Chrome Browser

| Platform | How Policy Applies |
|----------|-------------------|
| ChromeOS | Policies apply at device enrollment. No additional setup needed |
| Managed Chrome (Windows/Mac) | Requires Chrome Browser Cloud Management enrollment. Users must sign in to Chrome with a managed account |

## 6. Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not installing | Verify Installation Policy is "Force install", not "Allow install" |
| Policy not propagating | Wait up to 1 hour, or force refresh at chrome://policy |
| OU inheritance issues | Check that the extension is configured at the correct OU level. Child OUs inherit from parent unless overridden |
| Managed config not appearing | Ensure the JSON is valid (no trailing commas, correct types). Admin console silently rejects invalid JSON |
| Works on ChromeOS but not managed Chrome | Verify Chrome Browser Cloud Management is enabled and the user's Chrome profile is enrolled |
