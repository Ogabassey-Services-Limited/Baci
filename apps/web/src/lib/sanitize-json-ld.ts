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
 * Replace UTF-16 code units that are not part of a valid surrogate pair.
 *
 * JSON.stringify escapes lone surrogates as `\\udxxx`. Google treats those
 * escapes as truncated Unicode characters and rejects the complete JSON-LD
 * block. Keep valid astral characters intact, while making malformed legacy
 * values safe to serialize.
 */
export function replaceLoneSurrogates(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
        continue;
      }

      result += '\ufffd';
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      result += '\ufffd';
      continue;
    }

    result += value[index];
  }

  return result;
}

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
    return escapeHtml(replaceLoneSurrogates(obj)) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSchemaMarkup(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[replaceLoneSurrogates(key)] = sanitizeSchemaMarkup(
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
 * Escape the serialized JSON for the HTML script context while preserving
 * valid data values and repairing malformed lone surrogates for parsers,
 * including structured-data crawlers.
 */
export function safeJsonLdStringify(schema: unknown): string {
  const serialized = JSON.stringify(schema, (_key, value) => {
    if (typeof value === 'string') {
      return replaceLoneSurrogates(value);
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const repaired: Record<string, unknown> = {};
      for (const [key, propertyValue] of Object.entries(value)) {
        repaired[replaceLoneSurrogates(key)] = propertyValue;
      }
      return repaired;
    }

    return value;
  });

  if (serialized === undefined) return '';

  return serialized.replace(
    JSON_LD_SCRIPT_ESCAPE_REGEX,
    (match) => JSON_LD_SCRIPT_ESCAPE_MAP[match] ?? match
  );
}
