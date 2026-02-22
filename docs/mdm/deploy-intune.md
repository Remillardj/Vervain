# Deploying Vervain with Microsoft Intune

## Prerequisites

- Microsoft Intune admin access
- Chrome ADMX templates ingested (for OMA-URI policies)
- Target Windows devices with Google Chrome installed
- Vervain extension ID

## 1. Force-Install the Extension

Use an OMA-URI configuration profile to force-install via `ExtensionInstallForcelist`.

1. **Intune admin center** → Devices → Configuration profiles → **Create profile**
2. Platform: **Windows 10 and later**
3. Profile type: **Templates** → **Custom**
4. Name: "Chrome – Vervain Extension Install"
5. Add an OMA-URI setting:

| Field | Value |
|-------|-------|
| Name | Vervain Force Install |
| OMA-URI | `./Device/Vendor/MSFT/Policy/Config/Chrome~Policy~googlechrome~Extensions/ExtensionInstallForcelist` |
| Data type | String |
| Value | `<enabled/><data id="ExtensionInstallForcelistDesc" value="1&#xF000;YOUR_EXTENSION_ID;https://clients2.google.com/service/update2/crx"/>` |

6. Assign to your device group
7. Save

## 2. Configure Managed Settings

Add a second OMA-URI setting (in the same or a separate profile) for extension-specific managed policy.

| Field | Value |
|-------|-------|
| Name | Vervain Managed Settings |
| OMA-URI | `./Device/Vendor/MSFT/Policy/Config/Chrome~Policy~googlechrome~Extensions/ExtensionSettings` |
| Data type | String |
| Value | See JSON below |

### Example Configuration

```xml
<enabled/>
<data id="ExtensionSettings" value='{
  "YOUR_EXTENSION_ID": {
    "installation_mode": "force_installed",
    "update_url": "https://clients2.google.com/service/update2/crx",
    "managed_configuration": {
      "protectedDomains": ["yourcompany.com", "yourcompany.org"],
      "domainDetectionEnabled": true,
      "contactDetectionEnabled": true,
      "tiAutoScan": true,
      "enabledThreatFeeds": ["phishtank", "urlhaus", "threatfox", "openphish"],
      "aiProvider": "anthropic",
      "aiApiKey": "sk-ant-...",
      "aiAutoScan": true
    }
  }
}'/>
```

**Note:** The JSON must be on a single line in the actual OMA-URI value. It's shown formatted here for readability.

6. Assign and save

## 3. Verify Deployment

On a managed Windows device:

1. Run `gpupdate /force` or wait for Intune sync
2. Open Chrome → `chrome://policy`
3. Search for `ExtensionSettings` — your extension config should appear
4. Open Vervain Options page — managed settings show lock icons

## 4. Troubleshooting

| Issue | Solution |
|-------|----------|
| OMA-URI not applying | Verify the URI path is exact — Chrome ADMX templates must be ingested first |
| ADMX not ingested | Upload Chrome ADMX via Intune → Devices → Configuration profiles → Import ADMX |
| JSON parse error | Ensure no line breaks in the OMA-URI value string. Escape quotes properly |
| Policy sync delay | Intune policy sync can take 15-60 minutes. Force sync from Company Portal app |
| Extension installed but no managed settings | `ExtensionSettings` and `ExtensionInstallForcelist` are separate policies — both must be configured |
