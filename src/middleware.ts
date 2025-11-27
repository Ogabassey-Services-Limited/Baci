import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Root domain - merchants get subdomains like ogabassey.usebaci.com
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

// Reserved subdomains that should not be treated as merchant stores
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'dashboard', 'mail', 'smtp']);

// Valid subdomain pattern: alphanumeric and hyphens, 1-63 chars, no leading/trailing hyphens
const VALID_SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// Routes that should not be rewritten (main app routes)
const MAIN_APP_ROUTES = [
  '/dashboard',
  '/api',
  '/auth',
  '/login',
  '/onboarding',
  '/checkout',
  '/builder',
  '/reset-password',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
];

/**
 * Normalize a hostname by removing any port and converting it to lowercase.
 *
 * @param hostname - Hostname string that may include a port (e.g., "Example.COM:3000")
 * @returns The hostname without a port and in lowercase (e.g., "example.com")
 */
function normalizeHostname(hostname: string): string {
  return hostname.split(':')[0].toLowerCase();
}

/**
 * Checks whether a string is a valid DNS subdomain label consisting of lowercase letters, digits, and hyphens.
 *
 * The subdomain must be 1 to 63 characters long and must not start or end with a hyphen.
 *
 * @param subdomain - The subdomain label to validate
 * @returns `true` if `subdomain` meets the DNS label constraints, `false` otherwise
 */
function isValidSubdomain(subdomain: string): boolean {
  return VALID_SUBDOMAIN_REGEX.test(subdomain);
}

/**
 * Determine the leading subdomain of `hostname` when it is an exact subdomain of `parentDomain`.
 *
 * @param hostname - The host to inspect (may include a port).
 * @param parentDomain - The parent domain to match against (for example, `example.com`).
 * @returns The single-label subdomain (lowercased) if `hostname` is an exact subdomain of `parentDomain`, `null` otherwise.
 */
function extractSubdomain(hostname: string, parentDomain: string): string | null {
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
 * Determines whether a hostname matches the given root domain, allowing the `www.` prefix.
 *
 * @param hostname - The hostname to check (may include a port); comparison is case-insensitive.
 * @param rootDomain - The root domain to compare against.
 * @returns `true` if `hostname` equals `rootDomain` or `www.{rootDomain}`, `false` otherwise.
 */
function isRootDomain(hostname: string, rootDomain: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = rootDomain.toLowerCase();

  return normalizedHost === normalizedRoot || normalizedHost === `www.${normalizedRoot}`;
}

/**
 * Determines whether a hostname corresponds to a Vercel preview deployment.
 *
 * Accepts hostnames that end with `.vercel.app` and have a single subdomain segment
 * composed of lowercase letters, digits, and hyphens (no dots).
 *
 * @returns `true` if the hostname matches the `{hash}-{project}-{team}.vercel.app`-style preview pattern, `false` otherwise.
 */
function isVercelPreview(hostname: string): boolean {
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
 * Determines whether a hostname refers to the local development host.
 *
 * @param hostname - Hostname to check; may include a port (e.g., `localhost:3000`) which will be ignored.
 * @returns `true` if the normalized hostname is `localhost` or `127.0.0.1`, `false` otherwise.
 */
function isLocalhost(hostname: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1';
}

/**
 * Determines whether a hostname is a valid custom domain suitable for merchant routing.
 *
 * Performs basic format checks: contains at least one dot, is not an IPv4 address, starts and ends with an alphanumeric character, contains only lowercase letters, digits, hyphens, or dots, and does not contain consecutive dots.
 *
 * @param hostname - Hostname to validate
 * @returns `true` if `hostname` looks like a valid domain name for a custom domain, `false` otherwise.
 */
function isValidCustomDomain(hostname: string): boolean {
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

/**
 * Routes and rewrites requests based on the request hostname to support merchant subdomains, custom domains, the root domain, Vercel previews, and localhost development.
 *
 * @param request - The incoming Next.js request used to determine hostname, pathname, and user agent.
 * @returns A NextResponse that is one of:
 *   - a rewritten request to a storefront path with `x-merchant-slug` set for valid merchant subdomains,
 *   - a redirect to the root application domain when a subdomain attempts to access main app routes,
 *   - a normal response with `x-custom-domain` set for validated custom domains,
 *   - or a 400 Bad Request for invalid/suspicious hostnames. Security and caching headers are applied to responses.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Extract subdomain with proper validation
  let subdomain: string | null = null;

  if (isLocalhost(hostname)) {
    // In development, use path-based routing: localhost:3000/ogabassey/...
    // The (storefront)/[slug] routes handle this
    subdomain = null;
  } else if ((subdomain = extractSubdomain(hostname, ROOT_DOMAIN)) !== null) {
    // Production subdomain: ogabassey.usebaci.com
    // subdomain already extracted and validated by extractSubdomain
  } else if (isRootDomain(hostname, ROOT_DOMAIN) || isVercelPreview(hostname)) {
    // Root domain or Vercel preview - no subdomain, standard routing
    subdomain = null;
  } else if (isValidCustomDomain(hostname)) {
    // Custom domain: ogabassey.com - validated format
    // Let the page resolve merchant by domain lookup
    const response = NextResponse.next();
    response.headers.set('x-custom-domain', normalizeHostname(hostname));
    return applySecurityHeaders(response, pathname, userAgent);
  } else {
    // Invalid/suspicious hostname - reject
    return new NextResponse('Bad Request', { status: 400 });
  }

  // If we have a valid subdomain (not reserved), rewrite to storefront routes
  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    // Check if trying to access main app routes from subdomain - redirect to main domain
    if (MAIN_APP_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL(pathname, `https://${ROOT_DOMAIN}`));
    }

    // Rewrite subdomain requests to path-based storefront routes
    // ogabassey.usebaci.com/smartphones/iphone-12 -> /ogabassey/smartphones/iphone-12
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;

    const response = NextResponse.rewrite(url);
    response.headers.set('x-merchant-slug', subdomain);
    return applySecurityHeaders(response, pathname, userAgent);
  }

  // Standard request - apply caching headers
  const response = NextResponse.next();
  return applySecurityHeaders(response, pathname, userAgent);
}

/**
 * Applies security and cache-related HTTP headers to the provided NextResponse according to the request path and user agent.
 *
 * Chooses cache-control policies for static assets, product feed APIs, product pages, category pages, storefront home pages,
 * and authenticated routes; adjusts caching durations when the user agent appears to be a bot/crawler.
 *
 * @param response - The NextResponse to add headers to and return
 * @param pathname - The request pathname used to determine which headers to apply
 * @param userAgent - The user agent string used to detect bots and adjust caching behavior
 * @returns The same NextResponse instance with appropriate security and cache headers applied
 */
function applySecurityHeaders(response: NextResponse, pathname: string, userAgent: string): NextResponse {
  // Detect bots/crawlers for optimized SEO caching
  const isBot = /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i.test(userAgent);

  // Add cache headers for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  // Cache product feed APIs - longer for bots
  if (
    pathname.startsWith('/api/feed/google-merchant') ||
    pathname.startsWith('/api/feed/facebook') ||
    pathname.startsWith('/api/feed/tiktok')
  ) {
    response.headers.set(
      'Cache-Control',
      isBot ? 's-maxage=7200, stale-while-revalidate=172800' : 's-maxage=3600, stale-while-revalidate=86400'
    );
    return response;
  }

  // Cache product pages (both /products/slug and /category/slug formats)
  if (pathname.match(/^\/[^/]+\/products\/[^/]+$/) || pathname.match(/^\/[^/]+\/[^/]+\/[^/]+$/)) {
    response.headers.set(
      'Cache-Control',
      isBot ? 's-maxage=3600, stale-while-revalidate=86400' : 's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache category pages
  if (pathname.match(/^\/[^/]+\/[^/]+\/?$/) && !pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      isBot ? 's-maxage=1800, stale-while-revalidate=7200' : 's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache storefront home pages
  if (pathname.match(/^\/[^/]+\/?$/) && !pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      isBot ? 's-maxage=600, stale-while-revalidate=3600' : 's-maxage=60, stale-while-revalidate=300'
    );
    return response;
  }

  // No cache for authenticated routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (auth endpoints - handled by Supabase)
     * - api/webhook (webhook endpoints - need raw body)
     * - api/payments/webhook (payment webhooks - need raw body)
     * - manifest.webmanifest (PWA manifest)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     */
    '/((?!_next/image|_next/static|favicon.ico|api/auth|api/webhook|api/payments/webhook|manifest.webmanifest|robots.txt|sitemap.xml).*)',
  ],
};