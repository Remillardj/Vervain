# Vervain

A Chrome extension that protects users from phishing attempts by monitoring email domains and detecting suspicious variations, including impersonation.

## Features

- **Domain Protection**: Monitor your primary domain and additional domains for phishing attempts
- **Contact Verification**: Add trusted contacts to detect impersonation attacks
- **CSV Import**: Bulk import contacts and domains from CSV files
- **Real-time Detection**: Scan emails for suspicious domain variations
- **Chrome Extension**: Seamlessly integrates with Gmail and other email services

## CSV Import

Vervain supports bulk importing of contacts and domains via CSV files:

### Contacts CSV Format
```csv
Name,Email
John Doe,john.doe@example.com
Jane Smith,jane.smith@company.org
```

### Domains CSV Format
```csv
Domain
example.com
company.org
business.net
```

### How to Use
1. Go to the Options page in Vervain
2. Navigate to the Contacts or Domains tab
3. Use the CSV Import Manager to upload your file
4. Preview the data and import new entries
5. Download templates if you need help with formatting

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Chrome Extension APIs

## License

Copyright (c) 2025 Jaryd Remillard. All rights reserved.

This software is licensed for **personal, non-commercial use only**. You may use and modify the software for private purposes, but **distribution is prohibited**.

**Key restrictions:**
- ✅ Personal use allowed
- ✅ Modifications for personal use allowed
- ❌ No distribution of original or modified versions
- ❌ No commercial use

**Commercial licensing:** For commercial use or distribution rights, contact jaryd.remillard@gmail.com

See the [LICENSE](LICENSE) file for full terms.
