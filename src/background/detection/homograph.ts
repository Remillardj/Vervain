// Multi-char substitutions (order matters — check before single-char)
const MULTI_CHAR_SUBS: Array<[string, string]> = [
  ['rn', 'm'],
  ['cl', 'd'],
  ['vv', 'w'],
  ['nn', 'm'],
];

// Single-char confusable mappings (Unicode TR39 subset + number substitutions)
const CONFUSABLE_MAP: Record<string, string> = {
  // Cyrillic
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u044A': 'b',
  '\u0456': 'i', '\u0458': 'j', '\u04BB': 'h', '\u0455': 's',
  '\u0501': 'd', '\u051B': 'q',
  // Greek
  '\u03BF': 'o', '\u03B1': 'a', '\u03B5': 'e', '\u03B9': 'i',
  '\u03BA': 'k', '\u03BD': 'v', '\u03C1': 'p', '\u03C4': 't',
  '\u03C5': 'u', '\u03C9': 'w',
  // Number substitutions
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '6': 'b', '7': 't', '8': 'b', '9': 'g',
  // Symbol substitutions
  '$': 's', '@': 'a', '!': 'i', '|': 'l',
  // Latin extended
  '\u0131': 'i', '\u0142': 'l', '\u0127': 'h', '\u0111': 'd',
  '\u0167': 't',
};

export function normalizeHomographs(input: string): string {
  let s = input.toLowerCase();

  // Multi-char substitutions first
  for (const [from, to] of MULTI_CHAR_SUBS) {
    s = s.replaceAll(from, to);
  }

  // Single-char substitutions
  let result = '';
  for (const ch of s) {
    result += CONFUSABLE_MAP[ch] ?? ch;
  }

  return result;
}

/**
 * Build a map from normalized base name → original full domain.
 * Used for O(1) homograph detection in passive scan.
 */
export function buildNormalizedMap(domains: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const domain of domains) {
    const parts = domain.split('.');
    const baseName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    const normalized = normalizeHomographs(baseName);
    map.set(normalized, domain);
  }
  return map;
}
