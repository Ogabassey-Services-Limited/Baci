import { stripHtmlTags } from '@/lib/sanitize-core';

const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(
      /&(amp|lt|gt|quot|nbsp|#39);/g,
      (match) => HTML_ENTITY_REPLACEMENTS[match] || match
    );
}

export function normalizeSpecValueText(value: unknown) {
  if (typeof value === 'string') {
    return decodeHtmlEntities(stripHtmlTags(value)).replace(/\s+/g, ' ').trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return '';
}
