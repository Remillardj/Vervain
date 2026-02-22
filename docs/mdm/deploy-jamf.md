# Deploying Vervain with Jamf Pro

## Prerequisites

- Jamf Pro 10.x or later
- Target Macs with Google Chrome installed
- Vervain extension ID (from Chrome Web Store or your private hosting)

## 1. Force-Install the Extension

Create a Configuration Profile to force-install Vervain via Chrome's `ExtensionInstallForcelist` policy.

1. **Jamf Pro** → Computers → Configuration Profiles → **New**
2. Name: "Chrome – Vervain Extension"
3. Category: Security
4. Payload: **Custom Settings**
5. Upload or paste the following plist:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ExtensionInstallForcelist</key>
    <array>
        <string>YOUR_EXTENSION_ID;https://clients2.google.com/service/update2/crx</string>
    </array>
</dict>
</plist>
```

- **Preference Domain:** `com.google.Chrome`
- Replace `YOUR_EXTENSION_ID` with the actual extension ID

6. Scope to your target Smart Group or computer group
7. Save

## 2. Configure Managed Settings

Create a second Configuration Profile for Vervain's managed storage.

1. **Jamf Pro** → Computers → Configuration Profiles → **New**
2. Name: "Chrome – Vervain Settings"
3. Payload: **Custom Settings**
4. **Preference Domain:** `com.google.Chrome.extensions.YOUR_EXTENSION_ID`
5. Upload or paste the plist below

### Example Configuration

This enables domain protection, all threat feeds, auto-scanning, and provisions an AI key:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>protectedDomains</key>
    <array>
        <string>yourcompany.com</string>
        <string>yourcompany.org</string>
    </array>
    <key>domainDetectionEnabled</key>
    <true/>
    <key>contactDetectionEnabled</key>
    <true/>
    <key>tiAutoScan</key>
    <true/>
    <key>enabledThreatFeeds</key>
    <array>
        <string>phishtank</string>
        <string>urlhaus</string>
        <string>threatfox</string>
        <string>openphish</string>
    </array>
    <key>aiProvider</key>
    <string>anthropic</string>
    <key>aiApiKey</key>
    <string>sk-ant-...</string>
    <key>aiAutoScan</key>
    <true/>
</dict>
</plist>
```

6. Scope to the same target group
7. Save

## 3. Verify Deployment

On a managed Mac:

1. Open Chrome and navigate to `chrome://policy`
2. Search for your extension ID — managed keys should appear
3. Open Vervain's Options page — managed settings show a lock icon
4. Locked toggles cannot be changed by the user

## 4. Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not installing | Verify `ExtensionInstallForcelist` plist domain is `com.google.Chrome` (not `com.google.Chrome.extensions`) |
| Settings not applying | Verify managed settings plist domain is `com.google.Chrome.extensions.YOUR_EXTENSION_ID` |
| Profile not reaching Macs | Check scope targeting and Jamf inventory sync |
| Settings visible in chrome://policy but not in extension | Restart Chrome. Managed storage loads at startup |
| Lock icons not showing | Extension reads managed storage on load — close and reopen the Options page |
