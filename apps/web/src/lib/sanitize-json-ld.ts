// JSON-LD Sanitization Utilities
// Safe escaping and sanitization for structured data (JSON-LD) schemas

import { escapeHtml, sanitizeUrl } from './sanitize-core';

const JSON_LD_SCRIPT_ESCAPE_REGEX = /[<>&\u2028\u2029]/g;

const JSON_LD_SCRIPT_ESCAPE_MAP: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * Validate and normalize a URL for use in JSON-LD schemas.
 * Script-context escaping is handled by safeJsonLdStringify().
 */
export function sanitizeSchemaUrl(url: string): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return '';
  return sanitized;
}

/**
 * Recursively sanitize all string values in a JSON-LD schema object.
 * This prevents XSS when rendering schema_markup from the database.
 * Performance: O(n) where n is total number of values, with minimal memory overhead.
 */
export function sanitizeSchemaMarkup<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return escapeHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSchemaMarkup(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[key] = sanitizeSchemaMarkup(
          (obj as Record<string, unknown>)[key]
        );
      }
    }
    return result as T;
  }

  // Numbers, booleans, etc. pass through unchanged
  return obj;
}

/**
 * Safely stringify a JSON-LD schema object for use in script tags.
 *
 * Escape the serialized JSON for the HTML script context without changing the
 * data values that JSON parsers, including structured-data crawlers, receive.
 */
export function safeJsonLdStringify<T extends Record<string, unknown>>(
  schema: T
): string {
  return JSON.stringify(schema).replace(
    JSON_LD_SCRIPT_ESCAPE_REGEX,
    (match) => JSON_LD_SCRIPT_ESCAPE_MAP[match] ?? match
  );
}
