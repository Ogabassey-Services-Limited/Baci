// Input Sanitization Utilities
// This module includes DOMPurify for HTML sanitization (requires jsdom on server)
// For server components that don't need HTML sanitization, import from './sanitize-core' instead

import DOMPurify from 'isomorphic-dompurify';

// Re-export all core sanitization functions for backwards compatibility
export {
    stripHtmlTags,
    sanitizeText,
    sanitizeEmail,
    sanitizePhone,
    sanitizeUrl,
    escapeHtml,
    sanitizeSchemaUrl,
    sanitizeSchemaMarkup,
    sanitizeNumber,
    sanitizeInteger,
    sanitizePrice,
    sanitizeObjectKeys,
    customerSchema,
    productSchema,
    orderSchema,
    sanitizeSearchQuery,
    sanitizeLikePattern,
    isValidUuid,
    sanitizeFileName,
    sanitizeJson,
    sanitizeSchemaObject,
    safeJsonLdStringify,
} from './sanitize-core';

/**
 * Sanitize HTML content to prevent XSS using DOMPurify
 * NOTE: This function requires jsdom on the server side.
 * For server components, consider using stripHtmlTags() from sanitize-core instead.
 */
export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}
