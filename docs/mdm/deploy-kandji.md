# Deploying Vervain with Kandji

## Prerequisites

- Kandji admin access
- Target Macs with Google Chrome installed
- Vervain extension ID (from Chrome Web Store or your private hosting)

## 1. Force-Install the Extension

Use a Custom Profile to force-install Vervain via Chrome's `ExtensionInstallForcelist` policy.

1. **Kandji** → Library → Add New → **Custom Profile**
2. Name: "Chrome – Vervain Extension"
3. Upload a `.mobileconfig` containing the following payload (or build it in your profile editor):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.google.Chrome</string>
            <key>PayloadIdentifier</key>
            <string>com.yourcompany.chrome.vervain.install</string>
            <key>PayloadUUID</key>
            <string>GENERATE-A-UUID-HERE</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>ExtensionInstallForcelist</key>
            <array>
                <string>YOUR_EXTENSION_ID;https://clients2.google.com/service/update2/crx</string>
            </array>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Chrome – Vervain Extension</string>
    <key>PayloadIdentifier</key>
    <string>com.yourcompany.chrome.vervain</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>GENERATE-A-UUID-HERE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
```

- Replace `YOUR_EXTENSION_ID` with the actual extension ID
- Generate unique UUIDs for both `PayloadUUID` fields (use `uuidgen` in Terminal)

4. Assign to the appropriate Blueprint
5. Save

## 2. Configure Managed Settings

Create a second Custom Profile for Vervain's managed storage.

1. **Kandji** → Library → Add New → **Custom Profile**
2. Name: "Chrome – Vervain Settings"
3. Upload a `.mobileconfig` with this payload:

### Example Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.google.Chrome.extensions.YOUR_EXTENSION_ID</string>
            <key>PayloadIdentifier</key>
            <string>com.yourcompany.chrome.vervain.settings</string>
            <key>PayloadUUID</key>
            <string>GENERATE-A-UUID-HERE</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>protectedDomains</key>
            <array>
                <string>yourcompany.com</string>
                <string>yourcompany.org</string>
            </array>
            <key>domainDetectionEnabled</key>
            <true/>
            <key>contactDetectionEnabled</key>
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
    </array>
    <key>PayloadDisplayName</key>
    <string>Chrome – Vervain Settings</string>
    <key>PayloadIdentifier</key>
    <string>com.yourcompany.chrome.vervain.config</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>GENERATE-A-UUID-HERE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
```

4. Assign to the same Blueprint
5. Save

## 3. Verify Deployment

On a managed Mac:

1. Open Chrome and navigate to `chrome://policy`
2. Search for your extension ID — managed keys should appear
3. Open Vervain's Options page — managed settings show a lock icon
4. Locked settings cannot be changed by the user

## 4. Blueprint Assignment

- Assign both profiles to the same Blueprint targeting your intended devices
- Kandji pushes profiles automatically on next check-in
- To deploy different configs per team, use separate Blueprints with distinct managed settings profiles

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not installing | Verify the install profile uses `PayloadType` `com.google.Chrome` (not the extensions subdomain) |
| Settings not applying | Verify the settings profile uses `PayloadType` `com.google.Chrome.extensions.YOUR_EXTENSION_ID` |
| Profile not reaching Macs | Check Blueprint assignment and device check-in status in Kandji |
| Settings visible in chrome://policy but not in extension | Restart Chrome. Managed storage loads at startup |
| Lock icons not showing | Close and reopen the Options page |
| UUID errors on upload | Each `PayloadUUID` must be unique — regenerate with `uuidgen` |
