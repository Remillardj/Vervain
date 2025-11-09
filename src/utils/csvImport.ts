export interface CSVImportResult {
  contacts: Array<{ name: string; email: string }>;
  domains: string[];
  errors: string[];
}

export interface CSVTemplate {
  contacts: string;
  domains: string;
}

export const CSV_TEMPLATES: CSVTemplate = {
  contacts: `Name,Email
John Doe,john.doe@example.com
Jane Smith,jane.smith@example.com`,
  domains: `Domain
example.com
company.org
business.net`
};

export function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    // Handle quoted fields with commas
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  });
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

export function importFromCSV(csvText: string, type: 'contacts' | 'domains'): CSVImportResult {
  const result: CSVImportResult = {
    contacts: [],
    domains: [],
    errors: []
  };

  try {
    const rows = parseCSV(csvText);
    
    if (rows.length === 0) {
      result.errors.push('CSV file is empty');
      return result;
    }

    if (type === 'contacts') {
      // Expect header row: Name, Email
      if (rows[0].length < 2) {
        result.errors.push('Contacts CSV must have at least 2 columns: Name and Email');
        return result;
      }

      // Skip header row and process data
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) {
          result.errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        const name = row[0].trim();
        const email = row[1].trim();

        if (!name) {
          result.errors.push(`Row ${i + 1}: Name is required`);
          continue;
        }

        if (!email) {
          result.errors.push(`Row ${i + 1}: Email is required`);
          continue;
        }

        if (!validateEmail(email)) {
          result.errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
          continue;
        }

        result.contacts.push({ name, email });
      }
    } else if (type === 'domains') {
      // Expect header row: Domain
      if (rows[0].length < 1) {
        result.errors.push('Domains CSV must have at least 1 column: Domain');
        return result;
      }

      // Skip header row and process data
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 1) {
          result.errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        const domain = row[0].trim();

        if (!domain) {
          result.errors.push(`Row ${i + 1}: Domain is required`);
          continue;
        }

        if (!validateDomain(domain)) {
          result.errors.push(`Row ${i + 1}: Invalid domain format: ${domain}`);
          continue;
        }

        result.domains.push(domain);
      }
    }

  } catch (error) {
    result.errors.push(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

export function downloadCSVTemplate(type: 'contacts' | 'domains'): void {
  const template = type === 'contacts' ? CSV_TEMPLATES.contacts : CSV_TEMPLATES.domains;
  const filename = `vervain-${type}-template.csv`;
  
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
