// Root domain - merchants get subdomains like ogabassey.usebaci.com
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

// Reserved subdomains that should not be treated as merchant stores
export const RESERVED_SUBDOMAINS = new Set([
    'www',
    'app',
    'api',
    'admin',
    'dashboard',
    'mail',
    'smtp',
]);

// Valid subdomain pattern: alphanumeric and hyphens, 1-63 chars, no leading/trailing hyphens
const VALID_SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Normalize hostname: remove port and convert to lowercase
 */
export function normalizeHostname(hostname: string): string {
    return hostname.split(':')[0].toLowerCase();
}

/**
 * Validate subdomain follows DNS standards
 * - Only lowercase alphanumeric and hyphens
 * - 1-63 characters
 * - Cannot start or end with hyphen
 */
export function isValidSubdomain(subdomain: string): boolean {
    return VALID_SUBDOMAIN_REGEX.test(subdomain);
}

/**
 * Safely check if hostname is a subdomain of a given parent domain
 * This prevents attacks like "evilusebaci.com" matching "usebaci.com"
 */
export function extractSubdomain(
    hostname: string,
    parentDomain: string
): string | null {
    const normalizedHost = normalizeHostname(hostname);
    const normalizedParent = parentDomain.toLowerCase();
    const expectedSuffix = `.${normalizedParent}`;

    // Must end with .parentdomain exactly
    if (!normalizedHost.endsWith(expectedSuffix)) {
        return null;
    }

    // Extract subdomain part
    const subdomain = normalizedHost.slice(0, -expectedSuffix.length);

    // Validate: not empty, no dots (no nested subdomains), valid DNS characters
    if (!subdomain || subdomain.includes('.') || !isValidSubdomain(subdomain)) {
        return null;
    }

    return subdomain;
}

/**
 * Check if hostname exactly matches our root domain (with optional www)
 */
export function isRootDomain(hostname: string, rootDomain: string): boolean {
    const normalizedHost = normalizeHostname(hostname);
    const normalizedRoot = rootDomain.toLowerCase();

    return (
        normalizedHost === normalizedRoot ||
        normalizedHost === `www.${normalizedRoot}`
    );
}

/**
 * Check if hostname is a Vercel preview deployment
 * Validates exact structure: {hash}-{project}-{team}.vercel.app
 */
export function isVercelPreview(hostname: string): boolean {
    const normalizedHost = normalizeHostname(hostname);

    // Must end with exactly .vercel.app
    if (!normalizedHost.endsWith('.vercel.app')) {
        return false;
    }

    // Extract the subdomain part before .vercel.app
    const vercelSubdomain = normalizedHost.slice(0, -'.vercel.app'.length);

    // Vercel subdomains are alphanumeric with hyphens, typically contain project identifiers
    // Reject if empty or contains dots (nested subdomains)
    if (!vercelSubdomain || vercelSubdomain.includes('.')) {
        return false;
    }

    return isValidSubdomain(vercelSubdomain);
}

/**
 * Check if this is localhost/development environment (with or without subdomain)
 */
export function isLocalhost(hostname: string): boolean {
    const normalizedHost = normalizeHostname(hostname);
    return (
        normalizedHost === 'localhost' ||
        normalizedHost === '127.0.0.1' ||
        normalizedHost.endsWith('.localhost') // subdomain.localhost:3000
    );
}

/**
 * Extract subdomain from localhost for development testing
 * e.g., ogabassey.localhost:3000 -> ogabassey
 */
export function extractLocalhostSubdomain(hostname: string): string | null {
    const normalizedHost = normalizeHostname(hostname);

    if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') {
        return null; // Plain localhost - no subdomain
    }

    if (normalizedHost.endsWith('.localhost')) {
        const subdomain = normalizedHost.slice(0, -'.localhost'.length);
        if (subdomain && !subdomain.includes('.') && isValidSubdomain(subdomain)) {
            return subdomain;
        }
    }

    return null;
}

/**
 * Validate custom domain format (basic validation)
 * Must be a valid-looking domain, not an IP, not containing suspicious patterns
 */
export function isValidCustomDomain(hostname: string): boolean {
    const normalizedHost = normalizeHostname(hostname);

    // Must have at least one dot (domain.tld)
    if (!normalizedHost.includes('.')) return false;

    // No IP addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(normalizedHost)) return false;

    // Basic domain validation: alphanumeric, hyphens, dots
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(normalizedHost)) return false;

    // No consecutive dots
    if (normalizedHost.includes('..')) return false;

    return true;
}
