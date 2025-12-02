/**
 * Validates that a slug is safe to use in URLs
 * 
 * Only allows alphanumeric characters, hyphens, and underscores
 * to prevent path traversal and injection attacks
 * 
 * @param slug - The slug to validate
 * @returns true if the slug is safe, false otherwise
 * 
 * @example
 * isSafeSlug('my-store-123') // true
 * isSafeSlug('../../etc/passwd') // false
 * isSafeSlug('store?redirect=evil.com') // false
 */
export function isSafeSlug(slug: string | undefined | null): boolean {
    if (!slug) return false;
    // Only allow alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(slug);
}

/**
 * Validates and sanitizes a slug for safe URL usage
 * 
 * @param slug - The slug to validate
 * @param fallback - Optional fallback value if slug is invalid
 * @returns The validated slug or fallback
 * 
 * @example
 * validateSlug('my-store', '#') // 'my-store'
 * validateSlug('../badslug', '#') // '#'
 */
export function validateSlug(
    slug: string | undefined | null,
    fallback = '#'
): string {
    return isSafeSlug(slug) ? (slug as string) : fallback;
}
