/**
 * Next.js 16 Proxy (Middleware)
 *
 * Handles:
 * - Multi-tenant routing (subdomains and custom domains)
 * - Security headers (CSP, HSTS, COOP, COEP)
 * - Authentication session management
 * - Ad tracking cookie capture
 * - Cache control per route type
 *
 * Note: Next.js 16 renamed middleware → proxy for security clarity.
 * This file serves as the application's middleware layer.
 * See: https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { trace } from '@opentelemetry/api';
import { NextRequest, NextResponse } from 'next/server';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import {
  CLICK_ID_PARAMS,
  extractClickIdsFromUrl,
  generateClickIdCookies,
} from '@/lib/ad-tracking-cookies';
import {
  getCustomDomainForSlug,
  getSlugForCustomDomain,
} from '@/lib/domain-cache-simple';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';

// Root domain - merchants get subdomains like ogabassey.usebaci.com
// Sanitize: trim whitespace and remove any stray newlines (env variable corruption protection)
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com')
  .trim()
  .replace(/[\r\n]/g, '');

// Reserved subdomains that should not be treated as merchant stores
const RESERVED_SUBDOMAINS = new Set([
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

// Platform-owned IndexNow key file. Scoped to this exact path so that merchants
// remain free to publish their own `/<key>.txt` file on custom domains without
// the proxy intercepting and bypassing their storefront rewrite.
const INDEXNOW_KEY_PATH = '/0751d5c882ab3d7c013ecbfe9e624d71.txt';
const KLUMP_WEBHOOK_API_PATH = '/api/payments/klump/webhook';
const LEGACY_KLUMP_WOOCOMMERCE_WEBHOOK_PATH = '/wc-api/klp_wc_payment_webhook';
const PUBLIC_MACHINE_READABLE_PATHS = new Set<string>([
  ...Object.values(STOREFRONT_AGENT_ROUTES),
  ...Object.values(STOREFRONT_FEED_ROUTES),
]);
const MERCHANT_CONTEXT_HEADERS = [
  'x-custom-domain',
  'x-merchant-domain',
  'x-merchant-slug',
] as const;

function cloneRequestHeadersWithoutMerchantContext(
  request: NextRequest
): Headers {
  const headers = new Headers(request.headers);
  for (const header of MERCHANT_CONTEXT_HEADERS) {
    headers.delete(header);
  }
  return headers;
}

function isPublicMachineReadablePath(pathname: string): boolean {
  return PUBLIC_MACHINE_READABLE_PATHS.has(pathname);
}

// Pre-compiled regex patterns for performance (avoids recompilation on every request)
const STATIC_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|css|js|json)$/;
const IMAGE_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/;
const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i;
const PROTOCOL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const PRODUCT_PAGE_REGEX = /^\/[^/]+\/products\/[^/]+$/;
const NESTED_PRODUCT_REGEX = /^\/[^/]+\/[^/]+\/[^/]+$/;
const CATEGORY_PAGE_REGEX = /^\/[^/]+\/[^/]+\/?$/;
const STOREFRONT_HOME_REGEX = /^\/[^/]+\/?$/;
// Matches blog index/post paths on both the platform root (`/blog`, `/blog/...`)
// and slug-prefixed storefront variants served from the root domain
// (`/{slug}/blog`, `/{slug}/blog/...`). Used to canonicalize thumbnail params.
// The negative lookahead excludes reserved top-level routes (API handlers,
// dashboard screens, etc.) that happen to have a `/blog` child segment —
// e.g. `/api/blog/posts` must reach its handler instead of being redirected.
const BLOG_PATH_REGEX =
  /^(?:\/(?!(?:api|dashboard|admin|auth|login|onboarding|builder|reset-password|checkout|cart|staff|invite|actions|about|contact|pricing|privacy|terms|features|developers|demo|debug-auth|template-preview|track|_next|sitemap\.xml|robots\.txt|manifest\.webmanifest|favicon\.ico)(?:\/|$))[^/]+)?\/blog(?:\/.*)?$/;

// Routes that should not be rewritten (main app routes)
const MAIN_APP_ROUTES = [
  '/dashboard',
  // '/api', // Allow API access on subdomains (controlled by middleware)
  '/auth',
  '/login',
  '/onboarding',
  '/builder',
  '/reset-password',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.webmanifest',
];

// Platform root routes that should still be served by the main app but cannot
// live in MAIN_APP_ROUTES because merchant subdomains need storefront versions.
const ROOT_DOMAIN_ONLY_MAIN_APP_ROUTES = ['/checkout'];

// Prefixes whose tail segments may be case-sensitive (tracking numbers,
// API identifiers, build IDs). Only the prefix itself is lowercased.
// Important: do NOT derive from MAIN_APP_ROUTES wholesale — /checkout
// overlaps real storefront paths and must stay eligible for the later
// storefront-wide lowercase redirect.
const CASE_PRESERVING_PREFIXES = [
  '/api',
  '/track',
  '/_next',
  '/dashboard',
  '/auth',
  '/login',
  '/onboarding',
  '/builder',
  '/reset-password',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
];

const RESERVED_STOREFRONT_SEGMENTS = new Set([
  'about',
  'account',
  'api',
  'blog',
  'cart',
  // Legacy category roots — `/category/{slug}` and `/product-category/{slug}`
  // resolve to category pages (see storefront-link-normalization.ts), so they
  // must NOT be collapsed to `/products/{slug}` when stripping a merchant slug
  // prefix on custom domains.
  'category',
  'checkout',
  'faq',
  'llms-full.txt',
  'llms.txt',
  'pages',
  'privacy-policy',
  'product-category',
  'products',
  'repair',
  'repairs',
  'robots.txt',
  'sitemap',
  'swap',
  'terms',
  'track-order',
  'wallet',
  'wishlist',
]);

function sanitizeProxyRedirectPath(
  rawRedirect: string | null | undefined,
  defaultPath = '/dashboard'
): string {
  if (!rawRedirect) {
    return defaultPath;
  }

  if (
    !rawRedirect.startsWith('/') ||
    rawRedirect.startsWith('//') ||
    // Reject any backslash: the WHATWG URL parser normalizes `\` to `/` in
    // HTTPS-scheme contexts, so `/\evil.com` parses with host=evil.com. We
    // reject before the parse to avoid the authority-switch open-redirect.
    // Control characters are also rejected before URL parsing because the
    // parser strips them silently.
    rawRedirect.includes('\\') ||
    hasControlCharacter(rawRedirect) ||
    PROTOCOL_SCHEME_REGEX.test(rawRedirect)
  ) {
    return defaultPath;
  }

  try {
    const parsed = new URL(rawRedirect, 'https://usebaci.local');
    // Defense in depth: if the parser produced any host other than the
    // placeholder, the input contained an authority switch we didn't catch.
    if (parsed.host !== 'usebaci.local') {
      return defaultPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultPath;
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

/**
 * If pathname starts with `prefix` (case-insensitive), return the corrected
 * pathname with only the prefix lowercased and the tail untouched.
 * Returns null when no change is needed (already correct or no match).
 */
function normalizeLeadingPrefix(
  pathname: string,
  prefix: string
): string | null {
  const lowerPathname = pathname.toLowerCase();

  if (lowerPathname === prefix) {
    return pathname === prefix ? null : prefix;
  }

  if (lowerPathname.startsWith(`${prefix}/`)) {
    return pathname.startsWith(prefix)
      ? null
      : `${prefix}${pathname.slice(prefix.length)}`;
  }

  return null;
}

function isHexDigit(char: string | undefined): boolean {
  return Boolean(char && /^[0-9A-Fa-f]$/.test(char));
}

/**
 * Lowercase only the literal pathname characters and preserve percent-encoded
 * octets exactly as sent. Percent-escape hex casing is semantically
 * equivalent, so rewriting `%E2%80%9D` to `%e2%80%9d` creates noisy
 * self-referential redirects that crawlers can misclassify as loops.
 */
function lowercaseStorefrontPathname(pathname: string): string {
  let normalized = '';

  for (let index = 0; index < pathname.length; index += 1) {
    const currentChar = pathname[index];
    const nextChar = pathname[index + 1];
    const nextNextChar = pathname[index + 2];

    if (
      currentChar === '%' &&
      isHexDigit(nextChar) &&
      isHexDigit(nextNextChar)
    ) {
      normalized += pathname.slice(index, index + 3);
      index += 2;
      continue;
    }

    normalized += currentChar.toLowerCase();
  }

  return normalized;
}

function isLegacyKlumpWooCommerceWebhookPath(pathname: string): boolean {
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  return (
    normalizedPathname.toLowerCase() === LEGACY_KLUMP_WOOCOMMERCE_WEBHOOK_PATH
  );
}

function getNoTrailingSlashRedirectPath(pathname: string): string | null {
  if (pathname === '/' || !pathname.endsWith('/')) {
    return null;
  }

  const pathnameWithoutTrailingSlash = pathname.slice(0, -1);
  if (pathnameWithoutTrailingSlash.startsWith('/.well-known/')) {
    return null;
  }

  return pathnameWithoutTrailingSlash;
}

/**
 * Normalize hostname: remove port and convert to lowercase
 */
function normalizeHostname(hostname: string): string {
  return hostname.split(':')[0].toLowerCase();
}

/**
 * Validate subdomain follows DNS standards
 * - Only lowercase alphanumeric and hyphens
 * - 1-63 characters
 * - Cannot start or end with hyphen
 */
function isValidSubdomain(subdomain: string): boolean {
  return VALID_SUBDOMAIN_REGEX.test(subdomain);
}

/**
 * Safely check if hostname is a subdomain of a given parent domain
 * This prevents attacks like "evilusebaci.com" matching "usebaci.com"
 */
function extractSubdomain(
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
function isRootDomain(hostname: string, rootDomain: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = rootDomain.toLowerCase();

  return (
    normalizedHost === normalizedRoot ||
    normalizedHost === `www.${normalizedRoot}` ||
    // Explicitly allow usebaci.com (platform domain) to handle legacy access
    normalizedHost === 'usebaci.com' ||
    normalizedHost === 'www.usebaci.com'
  );
}

/**
 * Check if hostname is a Vercel preview deployment
 * Validates exact structure: {hash}-{project}-{team}.vercel.app
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
 * Check if this is localhost/development environment (with or without subdomain)
 */
function isLocalhost(hostname: string): boolean {
  const normalizedHost = normalizeHostname(hostname);

  // Standard localhost/loopback
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.endsWith('.localhost')
  ) {
    return true;
  }

  // Allow private/local IP ranges ONLY in development (for physical devices testing over WiFi)
  if (process.env.NODE_ENV === 'development') {
    // 192.168.x.x
    if (normalizedHost.startsWith('192.168.')) return true;
    // 10.x.x.x
    if (normalizedHost.startsWith('10.')) return true;
    // 172.16.x.x to 172.31.x.x
    const match172 = normalizedHost.match(/^172\.(1[6-9]|2[0-9]|3[01])\./);
    if (match172) return true;
  }

  return false;
}

/**
 * Extract subdomain from localhost for development testing
 * e.g., ogabassey.localhost:3000 -> ogabassey
 */
function extractLocalhostSubdomain(hostname: string): string | null {
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
 * Classify route type for selective security policies
 * - Admin routes: Dashboard, builder, onboarding (strict CSP with nonce)
 * - Auth routes: Login, signup, password reset (strict CSP with nonce)
 * - Storefront routes: Public merchant pages (relaxed CSP for ISR/SSG)
 * - API routes: Backend endpoints (basic CSP)
 */
function getRouteType(
  pathname: string
): 'admin' | 'auth' | 'storefront' | 'api' {
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/onboarding')
  ) {
    return 'admin';
  }

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/reset-password')
  ) {
    return 'auth';
  }

  if (pathname.startsWith('/api')) {
    return 'api';
  }

  return 'storefront';
}

function buildMerchantFeedPassThroughResponse({
  request,
  pathname,
  userAgent,
  hostname,
  customDomain,
  merchantSlug,
}: {
  request: NextRequest;
  pathname: string;
  userAgent: string;
  hostname: string;
  customDomain?: string;
  merchantSlug?: string | null;
}): NextResponse {
  const feedHeaders = cloneRequestHeadersWithoutMerchantContext(request);

  if (customDomain) {
    feedHeaders.set('x-custom-domain', customDomain);
    feedHeaders.set('x-merchant-domain', customDomain);
  }
  if (merchantSlug) {
    feedHeaders.set('x-merchant-slug', merchantSlug);
  }

  const response = NextResponse.next({
    request: {
      headers: feedHeaders,
    },
  });

  // Public machine-readable storefront contracts use the storefront security
  // profile: relaxed CSP is appropriate for storefront-scoped JSON/XML content.
  const routeType = getRouteType(pathname);
  const isLocal = isLocalhost(hostname);
  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    routeType,
    isLocal,
    undefined,
    request,
    hostname
  );
}

/**
 * Generate Content Security Policy based on route type
 * Multi-tenant strategy:
 * - Admin/Auth: Nonce-based CSP (strict, requires SSR)
 * - Storefront: Relaxed CSP (allows ISR/SSG caching)
 */
function generateCSP(
  routeType: 'admin' | 'auth' | 'storefront' | 'api',
  isLocal: boolean,
  nonce?: string
): string {
  const storefrontUnsafeEval = isLocal ? " 'unsafe-eval'" : '';
  const strictScriptSource = nonce
    ? `'self' 'nonce-${nonce}'`
    : "'self' 'unsafe-inline'";
  const baseDirectives = {
    'default-src': "'self'",
    'img-src': "'self' blob: data: https:",
    'font-src': "'self' data: https://fonts.gstatic.com",
    'media-src': "'self' https:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'frame-ancestors': "'self'",
    ...(isLocal ? {} : { 'upgrade-insecure-requests': '' }),
  };

  const directives =
    routeType === 'admin' || routeType === 'auth'
      ? {
          ...baseDirectives,
          // Next reads the forwarded request CSP and applies this nonce to its
          // framework and Flight script tags before rendering admin/auth pages.
          'script-src': `${strictScriptSource}${isLocal ? " 'unsafe-eval'" : ''} https://vercel.live https://va.vercel-scripts.com`,
          'script-src-attr': "'none'",
          'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
          'connect-src':
            "'self' https://*.supabase.co wss://*.supabase.co https://api.korapay.com https://generativelanguage.googleapis.com https://vercel.live https://vitals.vercel-insights.com https://helpdesk.usebaci.com",
          'frame-src': "'self' https://checkout.korapay.com",
          'form-action': "'self'",
        }
      : routeType === 'storefront'
        ? {
            ...baseDirectives,
            'script-src': `'self' 'unsafe-inline'${storefrontUnsafeEval} https://vercel.live https://va.vercel-scripts.com https://*.myhuaweicloud.com https://js.useklump.com https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://www.googletagservices.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://ad.doubleclick.net https://pubads.g.doubleclick.net https://tpc.googlesyndication.com https://cdn.ampproject.org https://*.adtrafficquality.google https://cm.g.doubleclick.net`,
            'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
            'connect-src':
              "'self' https://*.supabase.co https://vitals.vercel-insights.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://api.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://googleads.g.doubleclick.net https://pubads.g.doubleclick.net https://cdn.ampproject.org https://cm.g.doubleclick.net",
            'frame-src':
              "'self' https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://googleads.g.doubleclick.net https://*.safeframe.googlesyndication.com https://tpc.googlesyndication.com https://td.doubleclick.net https://www.google.com https://cdn.ampproject.org https://*.adtrafficquality.google https://ep2.adtrafficquality.google https://cm.g.doubleclick.net https://securepubads.g.doubleclick.net",
          }
        : {
            'default-src': "'self'",
            'object-src': "'none'",
            'frame-ancestors': "'none'", // APIs usually don't need to be framed
          };

  return Object.entries(directives)
    .map(([key, value]) => (value ? `${key} ${value}` : key).trim())
    .join('; ');
}

function generateCspNonce(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return encodeCspNonce(String.fromCharCode(...bytes));
  } catch {
    return encodeCspNonce(crypto.randomUUID());
  }
}

function encodeCspNonce(value: string): string {
  return btoa(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function shouldForwardStrictCspNonce(
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): routeType is 'admin' | 'auth' {
  return routeType === 'admin' || routeType === 'auth';
}

function buildStrictCspResponse(
  request: NextRequest,
  routeType: 'admin' | 'auth',
  isLocal: boolean
): { nonce: string; response: NextResponse } {
  const nonce = generateCspNonce();
  const csp = generateCSP(routeType, isLocal, nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  return {
    nonce,
    response: NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  };
}

/**
 * Convert a `.md` pathname into the corresponding `/api/llm/` path.
 *
 * Examples (with slug "ogabassey"):
 *   /index.html.md        → /api/llm/ogabassey
 *   /about.md             → /api/llm/ogabassey/about
 *   /shoes/index.html.md  → /api/llm/ogabassey/shoes
 *   /shoes/nike-air.md    → /api/llm/ogabassey/shoes/nike-air
 *   /blog/my-post.md      → /api/llm/ogabassey/blog/my-post
 */
function toLlmApiPath(pathname: string, slug: string): string {
  // Strip trailing /index.html.md or .md suffix to get the clean path
  let clean = pathname;
  if (clean.endsWith('/index.html.md')) {
    clean = clean.slice(0, -'/index.html.md'.length);
  } else if (clean.endsWith('.md')) {
    clean = clean.slice(0, -'.md'.length);
  }

  // Remove leading slash
  clean = clean.replace(/^\//, '');

  // Build the API path
  return clean ? `/api/llm/${slug}/${clean}` : `/api/llm/${slug}`;
}

/**
 * Next.js Middleware Function
 * Handles multi-tenant routing, security headers, caching, and authentication
 */
export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // ==== URL NORMALIZATION: STATIC PREFIXES FIRST ====
  // Lowercase only prefixes that are EXCLUSIVELY non-storefront and/or have
  // case-sensitive tail segments. This MUST run before API rate limiting so
  // /API/... doesn't bypass the /api branch.
  for (const prefix of CASE_PRESERVING_PREFIXES) {
    const normalized = normalizeLeadingPrefix(pathname, prefix);
    if (normalized) {
      return NextResponse.redirect(
        new URL(normalized + request.nextUrl.search, request.url),
        308
      );
    }
  }

  const isLegacyKlumpWebhook = isLegacyKlumpWooCommerceWebhookPath(pathname);
  const apiSecurityPathname = isLegacyKlumpWebhook
    ? KLUMP_WEBHOOK_API_PATH
    : pathname;

  const noTrailingSlashPathname = isLegacyKlumpWebhook
    ? null
    : getNoTrailingSlashRedirectPath(pathname);
  if (noTrailingSlashPathname) {
    return NextResponse.redirect(
      new URL(noTrailingSlashPathname + request.nextUrl.search, request.url),
      308
    );
  }

  // ==== RATE LIMITING (API Routes) ====
  // Protect API endpoints from abuse
  if (apiSecurityPathname.startsWith('/api')) {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.resetTime
      );
    }

    // ==== INPUT VALIDATION (Mutation Requests) ====
    // Enforce Content-Type and body size limits at the edge
    const method = request.method;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      // Reject oversized payloads (2MB limit, matches serverActions.bodySizeLimit)
      const contentLength = request.headers.get('content-length');
      if (
        contentLength &&
        Number.parseInt(contentLength, 10) > 2 * 1024 * 1024
      ) {
        return NextResponse.json(
          { error: 'Payload too large', maxSize: '2MB' },
          { status: 413 }
        );
      }

      // Enforce valid Content-Type for API mutations
      // Allow: JSON, form-data (file uploads), URL-encoded forms
      // Skip check if Content-Type is missing (some clients omit it)
      const contentType = request.headers.get('content-type') || '';
      if (
        contentType &&
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')
      ) {
        return NextResponse.json(
          { error: 'Unsupported Content-Type' },
          { status: 415 }
        );
      }
    }

    // ==== CSRF: ORIGIN-BASED PROTECTION (2026 Best Practice) ====
    // Verify the Origin header on state-changing requests to prevent CSRF.
    // Modern browsers always send Origin on cross-origin requests; SameSite=Lax
    // cookies (Supabase default) add defense-in-depth. This single middleware
    // check replaces per-route checkCsrfProtection() calls — no client-side
    // token wiring needed, zero risk of breaking callers.
    const mutationMethod = request.method;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(mutationMethod)) {
      // Skip: Bearer-authenticated requests (mobile apps) — tokens aren't
      // auto-attached like cookies, so CSRF doesn't apply.
      const authHeader = request.headers.get('Authorization');
      const isBearerAuth = authHeader?.startsWith('Bearer ');

      // Skip: Webhook endpoints — called by external services, not browsers.
      const isPaymentWebhook = /^\/api\/payments\/[^/]+\/webhook$/.test(
        apiSecurityPathname
      );
      const isWebhook =
        apiSecurityPathname.startsWith('/api/webhooks/') || isPaymentWebhook;

      // Skip: Auth callback routes — called by OAuth providers.
      const isAuthCallback = apiSecurityPathname.startsWith('/api/auth/');

      // Skip: Cron endpoints — called by Vercel cron, not browsers.
      const isCron = apiSecurityPathname.startsWith('/api/cron/');

      // Skip: Public analytics endpoint
      const isPublicAnalytics = apiSecurityPathname === '/api/platform/events';

      if (
        !isBearerAuth &&
        !isWebhook &&
        !isAuthCallback &&
        !isCron &&
        !isPublicAnalytics
      ) {
        const origin = request.headers.get('origin');

        // Origin is required on cross-site requests by all modern browsers.
        // Same-origin requests may omit it (e.g., form submissions), but
        // fetch() always sends it for non-GET methods.
        if (origin) {
          let originHostname: string;
          try {
            originHostname = new URL(origin).hostname.toLowerCase();
          } catch {
            return NextResponse.json(
              { error: 'Invalid Origin header' },
              { status: 403 }
            );
          }

          const normalizedRoot = ROOT_DOMAIN.toLowerCase();

          // Allow: exact root domain, any subdomain of root domain,
          // localhost/dev, and Vercel preview deployments.
          const isAllowed =
            originHostname === normalizedRoot ||
            originHostname.endsWith(`.${normalizedRoot}`) ||
            isLocalhost(originHostname) ||
            isVercelPreview(originHostname);

          if (!isAllowed) {
            // Check custom domains: look up whether this origin is a
            // registered merchant custom domain.
            const customSlug = await getSlugForCustomDomain(originHostname);
            if (!customSlug) {
              return NextResponse.json(
                { error: 'Cross-origin request blocked' },
                { status: 403 }
              );
            }
          }
        }
      }
    }
  }

  if (isLegacyKlumpWebhook) {
    const webhookUrl = new URL(
      KLUMP_WEBHOOK_API_PATH + request.nextUrl.search,
      request.url
    );

    const response = NextResponse.rewrite(webhookUrl);
    return applySecurityHeaders(
      response,
      KLUMP_WEBHOOK_API_PATH,
      userAgent,
      'api',
      isLocalhost(hostname),
      undefined,
      request,
      hostname
    );
  }

  // ==== BLOG MIGRATION REDIRECTS ====
  // 301 redirect old blog subdomain to new blog location
  // blog.ogabassey.com/* -> ogabassey.com/blog/*
  if (normalizeHostname(hostname) === 'blog.ogabassey.com') {
    // Strip accidental domain prefix from path (e.g., /ogabassey.com/blog/... → /blog/...)
    // Derive the root domain from the subdomain so this adapts automatically
    let cleanPath = pathname;
    const rootDomain = normalizeHostname(hostname).replace(/^blog\./, '');
    if (
      cleanPath.toLowerCase().startsWith(`/${rootDomain}/`) ||
      cleanPath.toLowerCase() === `/${rootDomain}`
    ) {
      cleanPath = cleanPath.slice(`/${rootDomain}`.length) || '/';
    }
    // Avoid double /blog/ when the malformed path already includes it
    if (cleanPath.startsWith('/blog/') || cleanPath === '/blog') {
      cleanPath = cleanPath.slice('/blog'.length) || '/';
    }
    const newPath = cleanPath === '/' ? '' : cleanPath;
    const newUrl = `https://ogabassey.com/blog${newPath}`;
    return NextResponse.redirect(newUrl, { status: 301 });
  }

  // ==== SECURITY: BLOCK KNOWN SEO SPAM ====
  // Block common spam patterns under /blog/ prevent "Crawled - currently not indexed"
  // and "Duplicate without user-selected canonical" errors (Soft 404s).
  // MOVED TO TOP to avoid redirecting spam.
  // Block legacy WordPress admin/auth probes under /blog/* AND
  // /{merchantSlug}/blog/* (root-domain storefronts proxy blog paths
  // under a merchant slug prefix). These are not public content pages
  // and should not be indexable. Match exact paths or true path segment
  // boundaries to avoid blocking legitimate post slugs that share these
  // prefixes (e.g. /blog/wp-admin-guide).
  if (
    /^\/(?:[^/]+\/)?blog\/(?:wp-admin|wp-login\.php|xmlrpc\.php)(?:\/|$)/i.test(
      pathname
    )
  ) {
    return new NextResponse('Gone', { status: 410 });
  }

  if (pathname.startsWith('/blog/')) {
    const lowerBlogPath = pathname.toLowerCase();
    const spamPatterns = [
      '/blog/shopdetail',
      '/blog/zhhant',
      '/blog/product',
      '/blog/category/product',
    ];
    if (
      spamPatterns.some(
        (pattern) =>
          lowerBlogPath === pattern || lowerBlogPath.startsWith(`${pattern}/`)
      )
    ) {
      return new NextResponse('Gone', { status: 410 });
    }

    // Canonicalize legacy WordPress category permalinks:
    // /blog/{category}/{post-slug} -> /blog/{post-slug}
    // Also drop thumbnail_id query param noise from migrated URLs
    // (both thumbnail_id and _thumbnail_id variants).
    // Exclude pagination, tags, and authors from being treated as posts.
    const blogExclusions = ['page', 'tag', 'author', 'category'];
    const blogMetadataEndpoints = ['opengraph-image', 'twitter-image'];
    const legacyCategoryMatch = pathname.match(/^\/blog\/([^/]+)\/([^/]+)\/?$/);
    const legacyCategoryTarget = legacyCategoryMatch?.[2]?.toLowerCase();
    const legacyCategoryTargetBase = legacyCategoryTarget?.replace(
      /\.(?:avif|gif|jpe?g|png|webp)$/,
      ''
    );
    const isBlogMetadataEndpoint =
      legacyCategoryTargetBase !== undefined &&
      blogMetadataEndpoints.includes(legacyCategoryTargetBase);
    const acceptHeader = request.headers.get('accept')?.toLowerCase() ?? '';
    const fetchDestination =
      request.headers.get('sec-fetch-dest')?.toLowerCase() ?? '';
    const isDocumentNavigation =
      fetchDestination === 'document' || acceptHeader.includes('text/html');
    const shouldBypassLegacyCategoryRedirect =
      isBlogMetadataEndpoint && !isDocumentNavigation;
    const isLegacyPost =
      legacyCategoryMatch &&
      !shouldBypassLegacyCategoryRedirect &&
      !blogExclusions.includes(legacyCategoryMatch[1].toLowerCase());

    const hasThumbnailId =
      request.nextUrl.searchParams.has('thumbnail_id') ||
      request.nextUrl.searchParams.has('_thumbnail_id');
    if (isLegacyPost || hasThumbnailId) {
      const redirectUrl = request.nextUrl.clone();
      if (isLegacyPost && legacyCategoryMatch) {
        redirectUrl.pathname = `/blog/${legacyCategoryMatch[2]}`;
      }
      redirectUrl.searchParams.delete('thumbnail_id');
      redirectUrl.searchParams.delete('_thumbnail_id');

      // Avoid self-redirect loops when only thumbnail_id was absent.
      if (
        redirectUrl.pathname !== pathname ||
        redirectUrl.search !== request.nextUrl.search
      ) {
        return NextResponse.redirect(redirectUrl, { status: 301 });
      }
    }
  }

  // ==== SEO: STRIP THUMBNAIL QUERY NOISE ====
  // WordPress/share tooling can append `thumbnail_id` or `_thumbnail_id`
  // to blog URLs. These params should not produce unique crawlable URLs.
  // Covers the platform blog (`/blog`, `/blog/...`) and storefront variants
  // served from the root domain (`/{slug}/blog`, `/{slug}/blog/...`).
  const isCanonicalizableBlogMethod =
    request.method === 'GET' || request.method === 'HEAD';

  if (
    isCanonicalizableBlogMethod &&
    BLOG_PATH_REGEX.test(pathname) &&
    (request.nextUrl.searchParams.has('thumbnail_id') ||
      request.nextUrl.searchParams.has('_thumbnail_id'))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete('thumbnail_id');
    redirectUrl.searchParams.delete('_thumbnail_id');
    return NextResponse.redirect(redirectUrl, 301);
  }

  // ==== RFC 8615: WELL-KNOWN PASSTHROUGH ====
  // Let .well-known requests reach App Router route handlers unmodified.
  // Apple/Android app link verifiers reject redirects and rewrites.
  if (
    pathname.startsWith('/.well-known/') &&
    !isPublicMachineReadablePath(pathname)
  ) {
    return NextResponse.next();
  }

  // ==== LLM DISCOVERY PASSTHROUGH ====
  // Keep host-scoped llms files available on both the platform domain and
  // merchant storefront domains without proxy rewrites.
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return NextResponse.next();
  }

  // ==== INDEXNOW KEY FILE PASSTHROUGH ====
  // IndexNow validates ownership via a root-level `/<key>.txt` file. We only
  // bypass storefront rewrites for Baci's own platform key AND only on the
  // platform host (or a Vercel preview of it). Exposing the platform key at
  // every tenant/custom-domain root would let third parties submit IndexNow
  // URLs for merchants they don't own — scope it to the host we actually own.
  // Merchants serve their own IndexNow key via storefront rewrites.
  if (
    pathname === INDEXNOW_KEY_PATH &&
    (isRootDomain(hostname, ROOT_DOMAIN) || isVercelPreview(hostname))
  ) {
    return NextResponse.next();
  }

  // ==== LLM MARKDOWN MIRRORS (slug-based paths) ====
  // For root-domain paths like /ogabassey/about.md, rewrite to /api/llm/ogabassey/about
  // to avoid route collisions with dynamic [category] segments.
  // Custom domain and subdomain .md paths are handled in their respective sections below.
  const isPlatformMarkdownHost =
    isRootDomain(hostname, ROOT_DOMAIN) ||
    isVercelPreview(hostname) ||
    (isLocalhost(hostname) && extractLocalhostSubdomain(hostname) === null);

  if (
    isPlatformMarkdownHost &&
    pathname.endsWith('.md') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next')
  ) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 1) {
      const slug = segments[0];
      const rest = pathname.slice(`/${slug}`.length);
      const mdUrl = request.nextUrl.clone();
      mdUrl.pathname = toLlmApiPath(rest, slug);
      return NextResponse.rewrite(mdUrl);
    }
  }

  // ==== SEO: ENFORCE LOWERCASE CANONICAL URLS ====
  // Full-path lowercase canonicalization for storefront routes and any other
  // public routes not covered by the prefix-only normalization above.
  // By the time execution reaches here, /api, /track, /_next, and other
  // main-app prefixes have already been normalized or excluded above, and
  // host-aware passthroughs (.well-known, llms) have been allowed through.
  const lowerPathname = pathname.toLowerCase();
  const normalizedStorefrontPathname = lowercaseStorefrontPathname(pathname);
  const isWellKnownPassthrough = lowerPathname.startsWith('/.well-known/');
  const isLlmsPassthrough =
    lowerPathname === '/llms.txt' || lowerPathname === '/llms-full.txt';
  const isStaticFile = STATIC_FILES_REGEX.test(lowerPathname);
  const isNonStorefrontPrefix = CASE_PRESERVING_PREFIXES.some(
    (prefix) =>
      lowerPathname === prefix || lowerPathname.startsWith(`${prefix}/`)
  );

  if (
    pathname !== normalizedStorefrontPathname &&
    !isNonStorefrontPrefix &&
    !isStaticFile &&
    !isWellKnownPassthrough &&
    !isLlmsPassthrough
  ) {
    return NextResponse.redirect(
      new URL(
        normalizedStorefrontPathname + request.nextUrl.search,
        request.url
      ),
      308
    );
  }

  // ==== AUTH MIDDLEWARE (Server-side session verification) ====
  // For protected routes, verify auth BEFORE rendering
  // Define protected route patterns
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/admin');

  // Define auth routes (login, signup, etc.)
  const isAuthRoute =
    pathname === '/login' ||
    // pathname === '/onboarding' || // Onboarding is protected, not an auth page to skip
    pathname === '/reset-password';

  // Only run auth check for protected or auth routes (skip for public routes)
  if (isProtectedRoute || isAuthRoute) {
    // Generate nonce and CSP before the app render. Next reads the forwarded
    // request CSP to nonce its framework and Flight scripts.
    const routeType = getRouteType(pathname);
    const isLocal = isLocalhost(hostname);
    const nonce = generateCspNonce();
    const csp = generateCSP(routeType, isLocal, nonce);

    // Prepare request headers with nonce
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    // Create a modified request instance to pass down
    const modifiedRequest = new NextRequest(request, {
      headers: requestHeaders,
    });

    // Create an initial response object that includes the modified request headers
    const initialResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Update session (validates auth token)
    // Pass the modifiedRequest so it sees the new headers, and initialResponse as base
    const { supabaseResponse, user } = await updateSession(
      modifiedRequest,
      initialResponse
    );

    // Protected routes: redirect to login if no user
    if (isProtectedRoute && !user) {
      /*
      console.log(
        'Middleware: No user found for protected route',
        pathname.replace(/[\r\n]/g, '')
      );
      */
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set(
        'redirect',
        `${pathname}${request.nextUrl.search}${request.nextUrl.hash}`
      );
      return applySecurityHeaders(
        NextResponse.redirect(url),
        pathname,
        userAgent,
        routeType,
        isLocal,
        nonce,
        undefined,
        hostname
      );
    }

    // Auth routes: redirect to dashboard if already logged in
    if (isAuthRoute && user) {
      // console.log('Middleware: User found on auth route, redirecting to dashboard');
      const redirectTo = sanitizeProxyRedirectPath(
        request.nextUrl.searchParams.get('redirect') ??
          request.nextUrl.searchParams.get('redirectTo')
      );
      const url = request.nextUrl.clone();
      const redirectUrl = new URL(redirectTo, request.nextUrl.origin);
      url.pathname = redirectUrl.pathname;
      url.search = redirectUrl.search;
      url.hash = redirectUrl.hash;
      return applySecurityHeaders(
        NextResponse.redirect(url),
        pathname,
        userAgent,
        routeType,
        isLocal,
        nonce,
        undefined,
        hostname
      );
    }

    // For protected routes, apply security headers to the supabase response
    if (isProtectedRoute) {
      return applySecurityHeaders(
        supabaseResponse,
        pathname,
        userAgent,
        routeType,
        isLocal,
        nonce, // Pass the pre-generated nonce
        undefined,
        hostname
      );
    }

    // For Auth routes that aren't redirecting, we also need CSP headers (e.g. Login form)
    if (isAuthRoute) {
      return applySecurityHeaders(
        supabaseResponse,
        pathname,
        userAgent,
        routeType,
        isLocal,
        nonce,
        undefined,
        hostname
      );
    }

    return supabaseResponse;
  }

  // Extract subdomain with proper validation
  let subdomain: string | null = null;

  if (isLocalhost(hostname)) {
    // In development, support BOTH:
    // 1. ogabassey.localhost:3000 (subdomain-based, preferred, matches production)
    // 2. localhost:3000/ogabassey (path-based, fallback)
    const localSubdomain = extractLocalhostSubdomain(hostname);
    /*
    console.log(
      `[Middleware] Localhost detected. Host: ${hostname}, Extracted subdomain: ${localSubdomain}`
    );
    */
    if (localSubdomain) {
      subdomain = localSubdomain;
    } else {
      // Plain localhost - let path-based routing handle it
      subdomain = null;
    }
  } else {
    const extractedSubdomain = extractSubdomain(hostname, ROOT_DOMAIN);
    if (extractedSubdomain !== null) {
      subdomain = extractedSubdomain;
    } else if (
      isRootDomain(hostname, ROOT_DOMAIN) ||
      isVercelPreview(hostname)
    ) {
      // Root domain or Vercel preview - no subdomain, standard routing
      subdomain = null;
    } else if (isValidCustomDomain(hostname)) {
      // Custom domain: ogabassey.com - validated format
      // Normalize: lowercase, remove port, and strip 'www.' prefix for consistent lookup
      const domain = normalizeHostname(hostname).replace(/^www\./, '');
      const domainPathSegments = pathname.split('/').filter(Boolean);
      const domainMerchantSlug = await getSlugForCustomDomain(domain);

      // Public machine-readable contracts are App Router routes, not storefront pages.
      // Run before slug-prefix canonicalization so a merchant slug named
      // "feeds" cannot shadow the canonical XML feed endpoint.
      if (isPublicMachineReadablePath(pathname)) {
        return buildMerchantFeedPassThroughResponse({
          request,
          pathname,
          userAgent,
          hostname,
          customDomain: domain,
          merchantSlug: domainMerchantSlug,
        });
      }

      if (
        domainMerchantSlug &&
        domainPathSegments[0]?.toLowerCase() ===
          domainMerchantSlug.toLowerCase() &&
        // Only canonicalize safe/idempotent methods. A 301 on POST/PUT/etc.
        // lets clients replay as GET, which drops the body and breaks
        // non-idempotent flows (checkout, order creation) when legacy
        // slug-prefixed API URLs are hit on a custom domain.
        (request.method === 'GET' || request.method === 'HEAD')
      ) {
        // First segment already confirmed equal (case-insensitive) to the
        // merchant slug above; drop it by length instead of building a regex
        // from a variable (avoids CWE-1333 and any escaping concerns).
        const strippedPathname =
          pathname.slice(domainPathSegments[0].length + 1) || '/';
        const strippedSegments = strippedPathname.split('/').filter(Boolean);
        const firstStrippedSegment = strippedSegments[0]?.toLowerCase();
        // Only collapse `/merchantSlug/{category}/{productSlug}` to
        // `/products/{productSlug}` — i.e. exactly two stripped segments. Longer
        // paths can be legitimate category subroutes such as
        // `/{category}/compare/{comparisonSlug}` or `/{category}/best-under/{priceBandSlug}`
        // (see apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/compare
        // and .../best-under). Collapsing those to `/products/{lastSegment}`
        // would 301 merchants to URLs that don't exist.
        const shouldNormalizeToProductRoute =
          strippedSegments.length === 2 &&
          !!firstStrippedSegment &&
          !RESERVED_STOREFRONT_SEGMENTS.has(firstStrippedSegment);

        const normalizedPathname = shouldNormalizeToProductRoute
          ? `/products/${strippedSegments[strippedSegments.length - 1]}`
          : strippedPathname;
        const normalizedUrl = `https://${domain}${normalizedPathname}${request.nextUrl.search}`;

        if (normalizedUrl !== request.nextUrl.href) {
          return NextResponse.redirect(normalizedUrl, 301);
        }
      }

      // Slug-prefixed API requests (e.g. POST /{merchantSlug}/api/orders) on
      // custom domains need to be rewritten to /api/... regardless of method.
      // A 301 redirect is unsafe for non-idempotent verbs (body is dropped on
      // replay), but an internal rewrite preserves method + body. Only applies
      // when the first segment matches the domain's merchant slug AND the
      // second segment is literally 'api'.
      if (
        domainMerchantSlug &&
        domainPathSegments[0]?.toLowerCase() ===
          domainMerchantSlug.toLowerCase() &&
        domainPathSegments[1]?.toLowerCase() === 'api'
      ) {
        const strippedApiPathname =
          pathname.slice(domainPathSegments[0].length + 1) || '/';
        const apiUrl = request.nextUrl.clone();
        apiUrl.pathname = strippedApiPathname;

        const apiHeaders = cloneRequestHeadersWithoutMerchantContext(request);
        apiHeaders.set('x-custom-domain', domain);
        apiHeaders.set('x-merchant-domain', domain);

        const response = NextResponse.rewrite(apiUrl, {
          request: {
            headers: apiHeaders,
          },
        });

        const routeType = getRouteType(strippedApiPathname);
        const isLocal = isLocalhost(hostname);
        return applySecurityHeaders(
          response,
          strippedApiPathname,
          userAgent,
          routeType,
          isLocal,
          undefined,
          request,
          hostname
        );
      }

      // API routes should NOT be rewritten - they exist at /api/*, not /domain/api/*
      // This fixes 405 errors when calling APIs from custom domains
      // API routes should NOT be rewritten - they exist at /api/*, not /domain/api/*
      // This fixes 405 errors when calling APIs from custom domains
      if (pathname.startsWith('/api')) {
        const requestHeaders =
          cloneRequestHeadersWithoutMerchantContext(request);
        requestHeaders.set('x-custom-domain', domain);
        requestHeaders.set('x-merchant-domain', domain);

        // API routes shouldn't rewrite, just pass through
        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        const routeType = getRouteType(pathname); // returns 'api'
        const isLocal = isLocalhost(hostname);
        return applySecurityHeaders(
          response,
          pathname,
          userAgent,
          routeType,
          isLocal,
          undefined,
          request,
          hostname
        );
      }

      // Prevent redirect loop: if the path already starts with the domain,
      // it means we've already rewritten. Just let it pass through.
      // Use segment boundary check to avoid false positives (e.g., /shop.common matching /shop.com)
      const isAlreadyRewritten =
        pathname === `/${domain}` || pathname.startsWith(`/${domain}/`);

      if (isAlreadyRewritten) {
        // Already rewritten, just pass through with headers set
        const requestHeaders =
          cloneRequestHeadersWithoutMerchantContext(request);
        requestHeaders.set('x-custom-domain', domain);
        requestHeaders.set('x-merchant-domain', domain);

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        const routeType = getRouteType(pathname);
        const isLocal = isLocalhost(hostname);
        // Custom Domain routes might need CSP too if they map to storefront?
        // But getRouteType logic treats them as storefront usually.
        // If they access dashboard logic via custom domain (unlikely), they would hit auth block first.

        return applySecurityHeaders(
          response,
          pathname,
          userAgent,
          routeType,
          isLocal,
          undefined, // Storefront doesn't need strict nonce usually, or we can add it if needed
          request,
          hostname
        );
      }

      // Sitemap file paths: rewrite using merchant slug (not domain) to avoid
      // dots in [slug], which break Next.js metadata file-convention routing.
      if (pathname.startsWith('/sitemap') || pathname === '/blog/sitemap.xml') {
        const sitemapUrl = request.nextUrl.clone();
        // Use merchant slug if found, otherwise fall through to domain-based rewrite
        sitemapUrl.pathname = `/${domainMerchantSlug ?? domain}${pathname}`;

        const sitemapHeaders =
          cloneRequestHeadersWithoutMerchantContext(request);
        sitemapHeaders.set('x-custom-domain', domain);
        sitemapHeaders.set('x-merchant-domain', domain);

        const response = NextResponse.rewrite(sitemapUrl, {
          request: {
            headers: sitemapHeaders,
          },
        });

        const routeType = getRouteType(pathname);
        const isLocal = isLocalhost(hostname);

        return applySecurityHeaders(
          response,
          pathname,
          userAgent,
          routeType,
          isLocal,
          undefined,
          request,
          hostname
        );
      }

      // LLM markdown mirrors: rewrite .md paths to /api/llm/ to avoid
      // route collisions with dynamic [category] segments in the storefront tree.
      if (pathname.endsWith('.md')) {
        if (domainMerchantSlug) {
          const mdUrl = request.nextUrl.clone();
          mdUrl.pathname = toLlmApiPath(pathname, domainMerchantSlug);

          const mdHeaders = cloneRequestHeadersWithoutMerchantContext(request);
          mdHeaders.set('x-custom-domain', domain);
          mdHeaders.set('x-merchant-domain', domain);

          return NextResponse.rewrite(mdUrl, {
            request: { headers: mdHeaders },
          });
        }
        // Slug lookup failed — fall through to standard domain rewrite
      }

      // First visit: Rewrite to /${domain}${pathname} so the storefront [slug] route handles it
      const url = request.nextUrl.clone();
      url.pathname = `/${domain}${pathname}`;

      const requestHeaders = cloneRequestHeadersWithoutMerchantContext(request);
      requestHeaders.set('x-custom-domain', domain);
      requestHeaders.set('x-merchant-domain', domain);

      const response = NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });

      // Generate route-specific CSP
      const routeType = getRouteType(pathname);
      const isLocal = isLocalhost(hostname);

      return applySecurityHeaders(
        response,
        pathname,
        userAgent,
        routeType,
        isLocal,
        undefined,
        request, // Pass request for click ID capture on storefront
        hostname
      );
    }
  }

  // ==== OPENTELEMETRY: MERCHANT CONTEXT ====
  // Inject merchant slug/domain into the active trace span for multi-tenant observability.
  // This enables per-merchant filtering in the Vercel Observability dashboard.
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    if (subdomain) activeSpan.setAttribute('merchant.slug', subdomain);

    // Capture custom domain if available (normalized domain from the logic below)
    const domain = normalizeHostname(hostname).replace(/^www\./, '');
    if (
      domain &&
      domain !== ROOT_DOMAIN &&
      !isLocalhost(hostname) &&
      !isVercelPreview(hostname)
    ) {
      activeSpan.setAttribute('merchant.domain', domain);
    }
  }

  // If we have a valid subdomain (not reserved), rewrite to storefront routes
  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    // Check if trying to access main app routes from subdomain - redirect to main domain
    if (MAIN_APP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL(pathname, `https://${ROOT_DOMAIN}`));
    }

    // ==== REDIRECT SUBDOMAIN TO CUSTOM DOMAIN ====
    // If merchant has a custom domain, redirect subdomain URLs to prevent duplicate content
    // Example: ogabassey.usebaci.com -> ogabassey.com
    if (!isLocalhost(hostname)) {
      const customDomain = await getCustomDomainForSlug(subdomain);
      if (customDomain) {
        const customDomainUrl = `https://${customDomain}${pathname}${request.nextUrl.search}`;
        return NextResponse.redirect(customDomainUrl, 301);
      }
    }

    // Rewrite subdomain requests to path-based storefront routes
    // ogabassey.usebaci.com/smartphones/iphone-12 -> /ogabassey/smartphones/iphone-12

    // ==== FIX: API Routes on Subdomains ====
    // Do NOT rewrite API routes to /[subdomain]/api/...
    // Instead, pass them through with headers
    if (pathname.startsWith('/api')) {
      const requestHeaders = cloneRequestHeadersWithoutMerchantContext(request);
      requestHeaders.set('x-merchant-slug', subdomain as string);

      // Pass through without rewriting path
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      const routeType = getRouteType(pathname); // returns 'api'
      const isLocal = isLocalhost(hostname);
      return applySecurityHeaders(
        response,
        pathname,
        userAgent,
        routeType,
        isLocal,
        undefined,
        request,
        hostname
      );
    }

    // Public machine-readable contracts are App Router routes, not storefront pages.
    if (isPublicMachineReadablePath(pathname)) {
      return buildMerchantFeedPassThroughResponse({
        request,
        pathname,
        userAgent,
        hostname,
        merchantSlug: subdomain,
      });
    }

    // LLM markdown mirrors: rewrite .md paths to /api/llm/ to avoid
    // route collisions with dynamic [category] segments in the storefront tree.
    if (pathname.endsWith('.md')) {
      const mdUrl = request.nextUrl.clone();
      mdUrl.pathname = toLlmApiPath(pathname, subdomain as string);

      const mdHeaders = cloneRequestHeadersWithoutMerchantContext(request);
      mdHeaders.set('x-merchant-slug', subdomain as string);

      return NextResponse.rewrite(mdUrl, {
        request: { headers: mdHeaders },
      });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;

    const requestHeaders = cloneRequestHeadersWithoutMerchantContext(request);
    requestHeaders.set('x-merchant-slug', subdomain as string);

    const response = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });

    const routeType = getRouteType(pathname);
    const isLocal = isLocalhost(hostname);

    return applySecurityHeaders(
      response,
      pathname,
      userAgent,
      routeType,
      isLocal,
      undefined, // Storefront doesn't strictly need nonce for now
      request, // Pass request for click ID capture on storefront
      hostname
    );
  }

  // ==== REDIRECT SLUG-BASED URLS TO CUSTOM DOMAIN ====
  // If a merchant has a custom domain, redirect slug-based URLs to prevent duplicate content
  // Example: usebaci.com/ogabassey -> ogabassey.com
  if (
    (isRootDomain(hostname, ROOT_DOMAIN) || isVercelPreview(hostname)) &&
    !isLocalhost(hostname)
  ) {
    const pathSegments = pathname.split('/').filter(Boolean);
    const isRootDomainOnlyMainAppRoute = ROOT_DOMAIN_ONLY_MAIN_APP_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (
      pathSegments.length >= 1 &&
      !isRootDomainOnlyMainAppRoute &&
      !MAIN_APP_ROUTES.some((route) => pathname.startsWith(route))
    ) {
      const potentialSlug = pathSegments[0];

      if (
        isValidSubdomain(potentialSlug) &&
        !RESERVED_SUBDOMAINS.has(potentialSlug)
      ) {
        const customDomain = await getCustomDomainForSlug(potentialSlug);
        if (customDomain) {
          const newPathname = pathname.replace(`/${potentialSlug}`, '') || '/';
          const customDomainUrl = `https://${customDomain}${newPathname}${request.nextUrl.search}`;
          return NextResponse.redirect(customDomainUrl, 301);
        }
      }
    }
  }

  // Standard request - generate route-specific CSP
  const routeType = getRouteType(pathname);
  const isLocal = isLocalhost(hostname);

  if (shouldForwardStrictCspNonce(routeType)) {
    const { nonce, response } = buildStrictCspResponse(
      request,
      routeType,
      isLocal
    );

    return applySecurityHeaders(
      response,
      pathname,
      userAgent,
      routeType,
      isLocal,
      nonce,
      request,
      hostname
    );
  }

  const response = NextResponse.next();
  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    routeType,
    isLocal,
    undefined,
    request, // Pass request for click ID capture on storefront
    hostname
  );
}

/**
 * Capture ad click IDs from URL params and set cookies
 * This enables better conversion attribution when sending offline conversions
 */
function captureAdClickIds(request: NextRequest, response: NextResponse): void {
  const searchParams = request.nextUrl.searchParams;

  // Check if any click ID params exist
  const hasClickIds = Object.keys(CLICK_ID_PARAMS).some((param) =>
    searchParams.has(param)
  );

  if (!hasClickIds) return;

  // Extract click IDs from URL
  const clickIds = extractClickIdsFromUrl(searchParams);

  // Generate cookies
  const cookies = generateClickIdCookies(clickIds);

  // Set cookies on response
  for (const cookie of cookies) {
    response.headers.append('Set-Cookie', cookie);
  }
}

function applySecurityHeaders(
  response: NextResponse,
  pathname: string,
  userAgent: string,
  routeType: 'admin' | 'auth' | 'storefront' | 'api',
  isLocal: boolean,
  nonce?: string,
  request?: NextRequest,
  hostname?: string
): NextResponse {
  // Capture ad click IDs from URL params (if request provided)
  if (request && routeType === 'storefront') {
    captureAdClickIds(request, response);
  }

  // Apply Content Security Policy
  const csp = generateCSP(routeType, isLocal, nonce);
  response.headers.set('Content-Security-Policy', csp);

  // Add missing security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  // Set x-nonce header for server components (admin/auth routes only)
  // 2026 pattern: Also include it in the response so it's visible in dev tools / debug
  if (nonce) {
    response.headers.set('x-nonce', nonce);
  }

  // Set pathname header for server components to detect current route
  response.headers.set('x-pathname', pathname);

  // HSTS: Enforce HTTPS with subdomains and preload (Lighthouse Best Practice)
  // Skip on localhost to avoid Unlighthouse/CI failures (ERR_SSL_PROTOCOL_ERROR)
  if (hostname && !isLocalhost(hostname)) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // COOP: Isolate top-level window from cross-origin documents (Lighthouse Best Practice)
  response.headers.set(
    'Cross-Origin-Opener-Policy',
    'same-origin-allow-popups'
  );

  // COEP: Cross-Origin Embedder Policy for SharedArrayBuffer support
  // Note: Google Ads/GPT don't support COEP yet, so we only apply it to admin/auth routes
  // where third-party ad embeds aren't needed. Storefront routes skip COEP to allow ads.
  // See: https://developers.google.com/publisher-tag/guides/cross-origin-embedder-policy
  if (routeType === 'admin' || routeType === 'auth') {
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  }
  // Storefront and API routes: no COEP to allow Google Ads iframes

  // Detect bots/crawlers for optimized SEO caching
  const isBot = BOT_USER_AGENT_REGEX.test(userAgent);

  // Add cache headers for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/images') ||
    pathname.match(IMAGE_FILES_REGEX)
  ) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
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
      isBot
        ? 's-maxage=7200, stale-while-revalidate=172800'
        : 's-maxage=3600, stale-while-revalidate=86400'
    );
    return response;
  }

  // Cache product pages (both /products/slug and /category/slug formats)
  if (
    pathname.match(PRODUCT_PAGE_REGEX) ||
    pathname.match(NESTED_PRODUCT_REGEX)
  ) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=3600, stale-while-revalidate=86400'
        : 's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache category pages
  if (
    pathname.match(CATEGORY_PAGE_REGEX) &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/api')
  ) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=1800, stale-while-revalidate=7200'
        : 's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache storefront home pages
  if (
    pathname.match(STOREFRONT_HOME_REGEX) &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/api')
  ) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=600, stale-while-revalidate=3600'
        : 's-maxage=60, stale-while-revalidate=300'
    );
    return response;
  }

  // No cache for authenticated routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      'no-cache, must-revalidate, max-age=0'
    );
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    '/agent-commerce.json',
    '/agent-trust.json',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/image(?:/.*[^/])?$|_next/static(?:/.*[^/])?$|favicon\\.ico$|manifest\\.webmanifest$|robots\\.txt$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|eot|css|js|json)$).*)',
  ],
};
