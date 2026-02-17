// JSON-LD Sanitization Utilities
// Safe escaping and sanitization for structured data (JSON-LD) schemas

import { escapeHtml, sanitizeUrl } from './sanitize-core';

/**
 * Sanitize and escape a URL for use in JSON-LD schemas.
 * Validates the URL protocol and escapes HTML-sensitive characters.
 */
export function sanitizeSchemaUrl(url: string): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return '';
  return escapeHtml(sanitized);
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
 * Sanitizes all string values and returns a safe JSON string.
 */
export function safeJsonLdStringify<T extends Record<string, unknown>>(
  schema: T
): string {
  const sanitized = sanitizeSchemaMarkup(schema);
  return JSON.stringify(sanitized);
}
