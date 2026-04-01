/**
 * Valid slug pattern: alphanumeric and hyphens, no file extensions.
 * Must start and end with alphanumeric character.
 */
export const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * Valid domain pattern: supports domains and subdomains (case-insensitive).
 * Allows alphanumeric labels separated by dots.
 */
export const VALID_DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Reserved paths that should NOT be treated as merchant slugs to avoid routing conflicts.
 */
export const RESERVED_PATHS = new Set([
  'cart',
  'checkout',
  'api',
  'auth',
  'login',
  'logout',
  'dashboard',
  'admin',
  'builder',
  'onboarding',
  'preview',
  'about',
  'contact',
  'blog',
  'pricing',
  'terms',
  'privacy',
  'faq',
  'features',
  'demo',
  'developers',
  'track',
  'invite',
  'reset-password',
  'template-preview',
  'orders',
  'saved',
  'addresses',
  'reviews',
  'help',
  'wallet',
  'repairs',
  'swap',
  'account',
  'delete-account',
  'images',
  'product',
]);

/**
 * Checks if the identifier looks like a domain name (contains a dot).
 * @param identifier The string to check.
 * @returns True if it matches the domain regex.
 */
export function isDomainIdentifier(identifier: string): boolean {
  // Reject common file extensions to prevent filenames being treated as domains
  if (/\.(ico|json|png|jpg|jpeg|svg|css|js|map|txt|xml)$/i.test(identifier)) {
    return false;
  }

  return (
    identifier.includes('.') &&
    VALID_DOMAIN_REGEX.test(identifier.toLowerCase())
  );
}

/**
 * Checks if the string is a valid merchant slug.
 * @param slug The string to check.
 * @returns True if valid format and not a reserved path.
 */
export function isValidMerchantSlug(slug: string): boolean {
  return (
    typeof slug === 'string' &&
    !!slug.trim() &&
    !slug.includes('.') && // No file extensions
    !RESERVED_PATHS.has(slug.toLowerCase()) && // Not a reserved path
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

/**
 * Validates if the string is either a valid slug OR a valid domain.
 * @param identifier The string to check.
 * @returns True if it matches either format.
 */
export function isValidMerchantIdentifier(identifier: string): boolean {
  return isValidMerchantSlug(identifier) || isDomainIdentifier(identifier);
}
