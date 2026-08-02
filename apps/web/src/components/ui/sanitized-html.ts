import { sanitizeHtml } from '@/lib/sanitize';
import type { SanitizeHtmlOptions } from '@/lib/sanitize-html-config';

declare const sanitizedHtmlBrand: unique symbol;

export type SanitizedHtml = string & {
  readonly [sanitizedHtmlBrand]: true;
};

export function sanitizeForSafeHtml(
  dirty: string,
  options: SanitizeHtmlOptions = {}
): SanitizedHtml {
  return sanitizeHtml(dirty, options) as SanitizedHtml;
}
