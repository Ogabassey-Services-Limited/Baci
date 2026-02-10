// Core Sanitization Utilities (No DOMPurify dependency)
// These functions are safe to use in Server Components without triggering jsdom loading
// For HTML sanitization that requires DOMPurify, use sanitize.ts instead

import z from 'zod';

/**
 * Strips HTML tags from a string by iteratively applying the regex until no more matches.
 * This prevents incomplete sanitization from nested patterns like <scr<script>ipt>.
 */
export function stripHtmlTags(text: string | null | undefined): string {
  // Handle null/undefined input
  if (text == null) return '';

  // Limit input length to prevent ReDoS attacks
  const maxLength = 100000;
  const truncated = text.length > maxLength ? text.slice(0, maxLength) : text;

  // Use non-greedy match with length limit per tag to prevent catastrophic backtracking
  const htmlTagRegex = /<[^>]{0,1000}>/g;
  let result = truncated;
  let previous: string;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Iteratively remove HTML tags until no more are found
  // This handles cases like <scr<script>ipt> which become <script> after one pass
  do {
    previous = result;
    result = result.replace(htmlTagRegex, '');
    iterations++;
  } while (result !== previous && iterations < maxIterations);

  return result;
}

/**
 * Sanitize plain text (remove HTML, trim, limit length)
 */
export function sanitizeText(text: string, maxLength: number = 10000): string {
  if (!text) return '';

  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');

  // Remove HTML tags (iteratively to handle nested patterns)
  sanitized = stripHtmlTags(sanitized);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sanitize phone number (remove non-numeric characters except +)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+\-\s()]/g, '').trim();
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Escape HTML-sensitive characters for safe use in JSON-LD scripts.
 * Prevents XSS attacks when placing values inside <script type="application/ld+json"> tags.
 * Uses Unicode escape sequences to prevent breaking out of the script context.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/"/g, '\\u0022')
    .replace(/'/g, '\\u0027');
}

/**
 * Sanitize and escape a URL for use in JSON-LD schemas.
 * Validates the URL protocol and escapes HTML-sensitive characters.
 */
export function sanitizeSchemaUrl(url: string): string {
  // First validate it's a proper URL with allowed protocol
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return '';

  // Then escape for JSON-LD context
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
 * Sanitize number input
 */
export function sanitizeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(value: unknown): number {
  const num = sanitizeNumber(value);
  return Number.isFinite(num) ? Math.floor(num) : 0;
}

/**
 * Sanitize price (ensure 2 decimal places, positive)
 */
export function sanitizePrice(value: unknown): number {
  const num = sanitizeNumber(value);
  return Math.max(0, Math.round(num * 100) / 100);
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys<T extends Record<string, unknown>>(
  obj: T
): T {
  const sanitized: Record<string, unknown> = {};

  for (const key in obj) {
    // Skip prototype properties
    if (!Object.hasOwn(obj, key)) continue;

    // Skip dangerous keys
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;

    sanitized[key] = obj[key];
  }

  return sanitized as T;
}

/**
 * Validate and sanitize customer data
 */
export const customerSchema = z.object({
  firstName: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeText(val)),
  lastName: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeText(val)),
  email: z.string().transform((val) => sanitizeEmail(val)),
  phone: z
    .string()
    .min(10)
    .max(20)
    .transform((val) => sanitizePhone(val)),
  address: z
    .string()
    .min(5)
    .max(500)
    .transform((val) => sanitizeText(val)),
  city: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => sanitizeText(val)),
  state: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => sanitizeText(val)),
});

/**
 * Validate and sanitize product data
 */
export const productSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(200)
    .transform((val) => sanitizeText(val)),
  description: z
    .string()
    .max(5000)
    .transform((val) => sanitizeText(val))
    .optional(),
  price: z
    .number()
    .min(0)
    .transform((val) => sanitizePrice(val)),
  stock: z
    .number()
    .int()
    .min(0)
    .transform((val) => sanitizeInteger(val))
    .optional(),
  category: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeText(val)),
  brand: z
    .string()
    .max(100)
    .transform((val) => sanitizeText(val))
    .optional(),
});

/**
 * Validate and sanitize order data
 */
export const orderSchema = z.object({
  customer_name: z
    .string()
    .min(1)
    .max(200)
    .transform((val) => sanitizeText(val)),
  customer_email: z.string().transform((val) => sanitizeEmail(val)),
  customer_phone: z
    .string()
    .min(10)
    .max(20)
    .transform((val) => sanitizePhone(val))
    .optional(),
  subtotal: z
    .number()
    .min(0)
    .transform((val) => sanitizePrice(val)),
  shipping_fee: z
    .number()
    .min(0)
    .transform((val) => sanitizePrice(val)),
  notes: z
    .string()
    .max(1000)
    .transform((val) => sanitizeText(val))
    .optional(),
});

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove special characters that could be used for injection
  // Includes PostgREST control characters (,)()|  to prevent filter injection
  let sanitized = query.replace(/[<>'"`;\\,()|]/g, '');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 200);

  return sanitized;
}

/**
 * Sanitize user-provided values for safe logging.
 * Prevents log injection attacks by removing control characters
 * (newlines, carriage returns, tabs) and non-printable characters.
 *
 * @param value - The value to sanitize (will be converted to string)
 * @param maxLength - Maximum length of the output (default: 200)
 * @returns A safe string suitable for logging
 */
export function sanitizeForLog(value: unknown, maxLength = 1000): string {
  try {
    if (value === undefined || value === null) return '';

    // Simple string conversion and cleaning for basic types
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      const str = String(value).slice(0, maxLength);
      return str.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7E]/g, '');
    }

    // For complex types, use JSON.stringify but wrap in try-catch for BigInt/Circular
    const json = JSON.stringify(value);
    const result = (json === undefined ? String(value) : json).slice(
      0,
      maxLength
    );
    return result.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7E]/g, '');
  } catch {
    // Ultimate fallback
    return String(value ?? '')
      .slice(0, maxLength)
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\x20-\x7E]/g, '');
  }
}

/**
 * Sanitize SQL LIKE pattern
 */
export function sanitizeLikePattern(pattern: string): string {
  // Escape special SQL LIKE characters
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');

  // Remove special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  sanitized = sanitized.substring(0, 255);

  return sanitized;
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): T | null {
  try {
    return schema.parse(input);
  } catch (error) {
    console.error('JSON validation failed:', error);
    return null;
  }
}

/**
 * Safely stringify a JSON-LD schema object for use in dangerouslySetInnerHTML.
 * This function sanitizes all string values and returns a safe JSON string.
 *
 * Usage:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schema) }}
 *   />
 */
export function safeJsonLdStringify<T extends Record<string, unknown>>(
  schema: T
): string {
  // Sanitize all string values in the schema
  const sanitized = sanitizeSchemaMarkup(schema);
  // JSON.stringify also escapes special characters
  return JSON.stringify(sanitized);
}
