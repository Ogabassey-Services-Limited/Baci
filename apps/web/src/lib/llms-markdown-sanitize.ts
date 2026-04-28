import { sanitizeText } from '@/lib/sanitize-core';

export const MAX_MARKDOWN_TEXT_LENGTH = 10_000;

const MARKDOWN_CONTROL_REGEX = /[\\`*_{}[\]()#+!|<>~-]/g;
const UNSAFE_MARKDOWN_SCHEME_REGEX = /\b(?:javascript|data|vbscript):/gi;

export function sanitizeMarkdownText(value: unknown): string {
  const raw =
    typeof value === 'string' ? value : value == null ? '' : String(value);

  return sanitizeText(raw, MAX_MARKDOWN_TEXT_LENGTH)
    .replace(/\s+/g, ' ')
    .replace(UNSAFE_MARKDOWN_SCHEME_REGEX, '[blocked]:')
    .replace(MARKDOWN_CONTROL_REGEX, '\\$&');
}
