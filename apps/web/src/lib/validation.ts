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

const MAX_MERCHANT_IDENTIFIER_LENGTH = 254;
const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';
const ROUTE_PLACEHOLDER_REGEX = /^\[[A-Za-z][A-Za-z0-9_]*\]$/;

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
  if (typeof identifier !== 'string') {
    return false;
  }

  if (
    !identifier.trim() ||
    identifier.length > MAX_MERCHANT_IDENTIFIER_LENGTH
  ) {
    return false;
  }

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
    slug.length <= MAX_MERCHANT_IDENTIFIER_LENGTH &&
    !slug.includes('.') && // No file extensions
    !RESERVED_PATHS.has(slug.toLowerCase()) && // Not a reserved path
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

/**
 * Detects if a string is a dynamic route placeholder from Next.js build compilation (e.g. "[slug]").
 */
export function isRoutePlaceholder(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return ROUTE_PLACEHOLDER_REGEX.test(trimmed);
}

export function isNextProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE;
}

/**
 * Only production builds may substitute mock data for Next route placeholders.
 * Runtime requests to literal placeholder paths must stay invalid so mock storefront
 * content can never be rendered or cached for public traffic.
 */
export function isBuildTimeRoutePlaceholder(
  value: string | null | undefined
): boolean {
  return isNextProductionBuildPhase() && isRoutePlaceholder(value);
}

/**
 * Validates if the string is either a valid slug OR a valid domain.
 * @param identifier The string to check.
 * @returns True if it matches either format.
 */
export function isValidMerchantIdentifier(identifier: string): boolean {
  return (
    isBuildTimeRoutePlaceholder(identifier) ||
    isValidMerchantSlug(identifier) ||
    isDomainIdentifier(identifier)
  );
}
