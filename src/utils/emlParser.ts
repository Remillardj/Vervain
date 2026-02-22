import type { EmailData } from '@/background/aiPrompt';

/**
 * Lightweight EML parser for RFC 2822 emails.
 * Handles text/plain, text/html, and basic multipart/alternative.
 * Returns the same EmailData shape used by buildUserMessage().
 */
export function parseEml(raw: string): EmailData {
  // Normalize line endings to \n
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split headers from body at first blank line
  const headerEndIdx = normalized.indexOf('\n\n');
  const headerBlock = headerEndIdx === -1 ? normalized : normalized.slice(0, headerEndIdx);
  const bodyBlock = headerEndIdx === -1 ? '' : normalized.slice(headerEndIdx + 2);

  // Parse headers (handle folded lines)
  const headers: Record<string, string> = {};
  const headerLines = headerBlock.split('\n');
  let currentKey = '';
  for (const line of headerLines) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] += ' ' + line.trim();
    } else {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).toLowerCase().trim();
        headers[currentKey] = line.slice(colonIdx + 1).trim();
      }
    }
  }

  const from = headers['from'] || '';
  const { name: senderName, email: senderEmail } = parseFromHeader(from);
  const subject = headers['subject'] || '';
  const contentType = headers['content-type'] || 'text/plain';
  const rawBody = getRawBody(bodyBlock, contentType);
  const body = contentType.includes('text/html') && !contentType.includes('boundary')
    ? stripHtml(rawBody)
    : rawBody;
  const urls = extractUrls(rawBody);

  return { senderName, senderEmail, subject, body, urls };
}

function parseFromHeader(from: string): { name: string; email: string } {
  // "Display Name" <email@example.com>  or  Display Name <email@example.com>  or  <email@example.com>
  const angleMatch = from.match(/^(.*?)\s*<([^>]+)>/);
  if (angleMatch) {
    const name = angleMatch[1].replace(/^["']|["']$/g, '').trim();
    return { name, email: angleMatch[2].trim() };
  }
  // Bare email
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+/);
  return { name: '', email: emailMatch ? emailMatch[0] : from.trim() };
}

function getRawBody(bodyBlock: string, contentType: string): string {
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    return extractMultipartBody(bodyBlock, boundaryMatch[1]);
  }
  return bodyBlock.trim();
}

function extractMultipartBody(bodyBlock: string, boundary: string): string {
  const parts = bodyBlock.split(new RegExp(`--${escapeRegex(boundary)}(?:--)?`));
  let textPart = '';
  let htmlPart = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const partHeaderEnd = trimmed.indexOf('\n\n');
    if (partHeaderEnd === -1) continue;

    const partHeaders = trimmed.slice(0, partHeaderEnd).toLowerCase();
    const partBody = trimmed.slice(partHeaderEnd + 2);

    if (partHeaders.includes('text/plain')) {
      textPart = partBody.trim();
    } else if (partHeaders.includes('text/html')) {
      htmlPart = partBody.trim();
    }
  }

  if (textPart) return textPart;
  if (htmlPart) return stripHtml(htmlPart);
  return bodyBlock.trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  return [...new Set(text.match(urlRegex) || [])];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
