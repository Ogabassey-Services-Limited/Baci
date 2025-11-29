// Core Sanitization Utilities (No DOMPurify dependency)
// These functions are safe to use in Server Components without triggering jsdom loading
// For HTML sanitization that requires DOMPurify, use sanitize.ts instead

import { z } from 'zod';

/**
 * Strips HTML tags from a string by iteratively applying the regex until no more matches.
 * This prevents incomplete sanitization from nested patterns like <scr<script>ipt>.
 */
export function stripHtmlTags(text: string): string {
    const htmlTagRegex = /<[^>]*>/g;
    let result = text;
    let previous: string;

    // Iteratively remove HTML tags until no more are found
    // This handles cases like <scr<script>ipt> which become <script> after one pass
    do {
        previous = result;
        result = result.replace(htmlTagRegex, '');
    } while (result !== previous);

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
        return obj.map(item => sanitizeSchemaMarkup(item)) as T;
    }

    if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = sanitizeSchemaMarkup((obj as Record<string, unknown>)[key]);
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
    return isNaN(num) ? 0 : num;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(value: unknown): number {
    return Math.floor(sanitizeNumber(value));
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
export function sanitizeObjectKeys<T extends Record<string, unknown>>(obj: T): T {
    const sanitized: Record<string, unknown> = {};

    for (const key in obj) {
        // Skip prototype properties
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

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
    firstName: z.string().min(1).max(100).transform((val) => sanitizeText(val)),
    lastName: z.string().min(1).max(100).transform((val) => sanitizeText(val)),
    email: z.string().email().transform((val) => sanitizeEmail(val)),
    phone: z.string().min(10).max(20).transform((val) => sanitizePhone(val)),
    address: z.string().min(5).max(500).transform((val) => sanitizeText(val)),
    city: z.string().min(2).max(100).transform((val) => sanitizeText(val)),
    state: z.string().min(2).max(100).transform((val) => sanitizeText(val)),
});

/**
 * Validate and sanitize product data
 */
export const productSchema = z.object({
    name: z.string().min(3).max(200).transform((val) => sanitizeText(val)),
    description: z.string().max(5000).transform((val) => sanitizeText(val)).optional(),
    price: z.number().min(0).transform((val) => sanitizePrice(val)),
    stock: z.number().int().min(0).transform((val) => sanitizeInteger(val)).optional(),
    category: z.string().min(1).max(100).transform((val) => sanitizeText(val)),
    brand: z.string().max(100).transform((val) => sanitizeText(val)).optional(),
});

/**
 * Validate and sanitize order data
 */
export const orderSchema = z.object({
    customer_name: z.string().min(1).max(200).transform((val) => sanitizeText(val)),
    customer_email: z.string().email().transform((val) => sanitizeEmail(val)),
    customer_phone: z.string().min(10).max(20).transform((val) => sanitizePhone(val)).optional(),
    subtotal: z.number().min(0).transform((val) => sanitizePrice(val)),
    shipping_fee: z.number().min(0).transform((val) => sanitizePrice(val)),
    notes: z.string().max(1000).transform((val) => sanitizeText(val)).optional(),
});

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
    // Remove special characters that could be used for injection
    let sanitized = query.replace(/[<>'"`;\\]/g, '');

    // Trim and limit length
    sanitized = sanitized.trim().substring(0, 200);

    return sanitized;
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
export function sanitizeJson<T>(input: unknown, schema: z.ZodSchema<T>): T | null {
    try {
        return schema.parse(input);
    } catch (error) {
        console.error('JSON validation failed:', error);
        return null;
    }
}

/**
 * Recursively sanitize all string values in an object for use in JSON-LD scripts.
 * This is useful when using pre-stored schema objects from the database.
 * Prevents XSS attacks by escaping HTML-sensitive characters in all string values.
 */
export function sanitizeSchemaObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return escapeHtml(obj) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeSchemaObject(item)) as T;
    }

    if (typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                sanitized[key] = sanitizeSchemaObject((obj as Record<string, unknown>)[key]);
            }
        }
        return sanitized as T;
    }

    // Numbers, booleans, etc. pass through unchanged
    return obj;
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
export function safeJsonLdStringify<T extends Record<string, unknown>>(schema: T): string {
    // Sanitize all string values in the schema
    const sanitized = sanitizeSchemaMarkup(schema);
    // JSON.stringify also escapes special characters
    return JSON.stringify(sanitized);
}
