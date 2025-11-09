// This is a simplified version of DNSTwist algorithm
// For a complete implementation, we would need a more robust algorithm

export interface DomainVariation {
  type: 'typo' | 'homograph' | 'bitsquatting' | 'hyphenation' | 'addition' | 'subdomain' | 'tld';
  domain: string;
}

export const generateVariations = (domain: string): DomainVariation[] => {
  const results: DomainVariation[] = [];
  const [name, tld] = domain.split('.');
  
  if (!name || !tld) return results;

  // Addition (character addition)
  const additions = 'abcdefghijklmnopqrstuvwxyz0123456789-';
  for (let i = 0; i < name.length + 1; i++) {
    for (let c = 0; c < additions.length; c++) {
      const newDomain = name.slice(0, i) + additions[c] + name.slice(i) + '.' + tld;
      results.push({ type: 'addition', domain: newDomain });
    }
  }

  // Typosquatting (character replacement)
  const keyboards: {[key: string]: string[]} = {
    'q': ['w', '1', 'a'],
    'w': ['q', 'e', '2', 's', 'a'],
    'e': ['w', 'r', '3', 'd', 's'],
    'r': ['e', 't', '4', 'f', 'd'],
    't': ['r', 'y', '5', 'g', 'f'],
    'y': ['t', 'u', '6', 'h', 'g'],
    'u': ['y', 'i', '7', 'j', 'h'],
    'i': ['u', 'o', '8', 'k', 'j'],
    'o': ['i', 'p', '9', 'l', 'k'],
    'p': ['o', '0', ';', 'l'],
    'a': ['q', 'w', 's', 'z'],
    's': ['w', 'e', 'd', 'x', 'z', 'a'],
    'd': ['e', 'r', 'f', 'c', 'x', 's'],
    'f': ['r', 't', 'g', 'v', 'c', 'd'],
    'g': ['t', 'y', 'h', 'b', 'v', 'f'],
    'h': ['y', 'u', 'j', 'n', 'b', 'g'],
    'j': ['u', 'i', 'k', 'm', 'n', 'h'],
    'k': ['i', 'o', 'l', ',', 'm', 'j'],
    'l': ['o', 'p', ';', '.', ',', 'k'],
    'z': ['a', 's', 'x'],
    'x': ['z', 's', 'd', 'c'],
    'c': ['x', 'd', 'f', 'v'],
    'v': ['c', 'f', 'g', 'b'],
    'b': ['v', 'g', 'h', 'n'],
    'n': ['b', 'h', 'j', 'm'],
    'm': ['n', 'j', 'k', ','],
    '1': ['2', 'q'],
    '2': ['1', '3', 'w', 'q'],
    '3': ['2', '4', 'e', 'w'],
    '4': ['3', '5', 'r', 'e'],
    '5': ['4', '6', 't', 'r'],
    '6': ['5', '7', 'y', 't'],
    '7': ['6', '8', 'u', 'y'],
    '8': ['7', '9', 'i', 'u'],
    '9': ['8', '0', 'o', 'i'],
    '0': ['9', 'p', 'o'],
  };

  for (let i = 0; i < name.length; i++) {
    const char = name[i].toLowerCase();
    const possibleTypos = keyboards[char] || [];
    
    for (const typo of possibleTypos) {
      const newDomain = name.slice(0, i) + typo + name.slice(i + 1) + '.' + tld;
      results.push({ type: 'typo', domain: newDomain });
    }
  }

  // Homograph attacks (similar looking characters)
  const homographs: {[key: string]: string[]} = {
    'a': ['à', 'á', 'â', 'ã', 'ä', 'å', 'ɑ', 'а', 'ạ', 'ǎ', 'ă', 'ȧ'],
    'b': ['d', 'lb', 'ʙ', 'Ь', 'ɓ', 'Б', 'ß', 'β'],
    'c': ['ϲ', 'с', 'ƈ', 'ċ', 'ć', 'ç'],
    'd': ['b', 'cl', 'ԁ', 'ɗ', 'đ'],
    'e': ['é', 'ê', 'ë', 'ē', 'ĕ', 'ě', 'ė', 'е', 'ё', 'э', 'ҽ'],
    'f': ['Ϝ', 'ƒ', 'Ғ'],
    'g': ['q', 'ɡ', 'ɢ', 'ɖ', 'ġ', 'ğ', 'ģ', 'ǧ', 'ǵ'],
    'h': ['ln', 'һ', 'ħ', 'ɦ', 'ḥ', 'ḩ', 'ⱨ'],
    'i': ['1', 'l', 'í', 'ï', 'ı', 'ɩ', 'ι', 'і', 'ї', 'ł'],
    'j': ['ј', 'ʝ', 'ɉ'],
    'k': ['lc', 'κ', 'к', 'ⱪ', 'ĸ'],
    'l': ['1', 'i', 'ɫ', 'ł'],
    'm': ['n', 'nn', 'rn', 'rr', 'ṃ', 'ṁ', 'ᴍ'],
    'n': ['m', 'r', 'ń', 'ñ', 'ņ', 'ṋ', 'ṅ', 'ṇ', 'н'],
    'o': ['0', 'Ο', 'ο', 'О', 'о', 'Օ', 'ȯ', 'ọ', 'ỏ', 'ơ', 'ó', 'ö'],
    'p': ['ρ', 'р', 'ṗ', 'ƿ'],
    'q': ['g', 'զ', 'ԛ', 'ʠ'],
    'r': ['ʀ', 'Г', 'ᴦ', 'ɼ', 'ɽ'],
    's': ['Ⴝ', 'ѕ', 'ʂ', 'ś', 'ş'],
    't': ['τ', 'т', 'ţ', 'ț', 'ŧ'],
    'u': ['μ', 'υ', 'Ս', 'ս', 'ц', 'ᴜ', 'ǔ', 'ŭ'],
    'v': ['ν', 'υ', 'ѵ'],
    'w': ['vv', 'ѡ', 'ԝ', 'ϖ', 'ŵ'],
    'x': ['х', 'ҳ', 'ẋ'],
    'y': ['ʏ', 'γ', 'у', 'Ү', 'ý'],
    'z': ['ʐ', 'ż', 'ź', 'ʐ', 'ᴢ']
  };

  for (let i = 0; i < name.length; i++) {
    const char = name[i].toLowerCase();
    const possibleHomographs = homographs[char] || [];
    
    for (const homograph of possibleHomographs) {
      const newDomain = name.slice(0, i) + homograph + name.slice(i + 1) + '.' + tld;
      results.push({ type: 'homograph', domain: newDomain });
    }
  }

  // Hyphenation (adding hyphens)
  for (let i = 1; i < name.length; i++) {
    const newDomain = name.slice(0, i) + '-' + name.slice(i) + '.' + tld;
    results.push({ type: 'hyphenation', domain: newDomain });
  }

  // Subdomain (adding dots)
  for (let i = 1; i < name.length; i++) {
    const newDomain = name.slice(0, i) + '.' + name.slice(i) + '.' + tld;
    results.push({ type: 'subdomain', domain: newDomain });
  }

  // Bitsquatting (bit flipping)
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const flippedCharCode = c ^ (1 << j);
      if (flippedCharCode >= 32 && flippedCharCode <= 126) { // Printable ASCII
        const flippedChar = String.fromCharCode(flippedCharCode);
        if (/[a-zA-Z0-9-]/.test(flippedChar)) {
          const newDomain = name.slice(0, i) + flippedChar + name.slice(i + 1) + '.' + tld;
          results.push({ type: 'bitsquatting', domain: newDomain });
        }
      }
    }
  }

  // TLD variations
  if (tld === 'com') {
    results.push({ type: 'tld', domain: name + '.org' });
    results.push({ type: 'tld', domain: name + '.net' });
    results.push({ type: 'tld', domain: name + '.co' });
  }

  return results;
};

// Extract domain from email address
export const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1] : '';
};

// Check if a domain is suspicious (similar to user's domain)
export const isSuspiciousDomain = (
  domain: string, 
  userDomain: string, 
  variations: DomainVariation[]
): boolean => {
  if (!domain || !userDomain) return false;
  
  // If it's the exact domain, it's not suspicious
  if (domain === userDomain) return false;
  
  // Check if the domain is in our list of variations
  return variations.some(variation => variation.domain === domain);
};
