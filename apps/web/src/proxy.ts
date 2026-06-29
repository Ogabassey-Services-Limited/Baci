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
import {
  STOREFRONT_PUBLIC_CACHE_POLICIES,
  type StorefrontPublicCachePolicy,
} from '@/config/storefront-cache';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import {
  getStorefrontMetadataCacheBucket,
  STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
  STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM,
} from '@/config/storefront-metadata-cache-bots';
import { getInternalApiSecret } from '@/env';
import {
  CLICK_ID_PARAMS,
  extractClickIdsFromUrl,
  generateClickIdCookies,
} from '@/lib/ad-tracking-cookies';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  getCustomDomainForSlug,
  getSlugForCustomDomain,
} from '@/lib/domain-cache-simple';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { getStorefrontProductCanonicalRedirectResult } from '@/lib/storefront-product-canonical-redirect';
import { resolveStorefrontProductSlugResolution } from '@/lib/storefront-product-slug-membership';
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
const CACHE_UNSAFE_ENCODED_DOUBLE_QUOTE_REGEX = /%e2%80%(?:9c|9d|b3)/gi;
const CACHE_UNSAFE_ENCODED_SINGLE_QUOTE_REGEX = /%e2%80%(?:98|99|b2)/gi;
const CACHE_UNSAFE_ENCODED_SPACE_OR_DASH_REGEX =
  /(?:%c2%a0|%e2%80%(?:90|91|92|93|94|95))/gi;

// Platform-owned IndexNow key file. Scoped to this exact path so that merchants
// remain free to publish their own `/<key>.txt` file on custom domains without
// the proxy intercepting and bypassing their storefront rewrite.
const INDEXNOW_KEY_PATH = '/0751d5c882ab3d7c013ecbfe9e624d71.txt';
const ANALYTICS_CONVERSION_API_PATH = '/api/analytics/conversion';
const LEGACY_ANALYTICS_CONVERSION_PATH = '/analytics/conversion';
const KLUMP_WEBHOOK_API_PATH = '/api/payments/klump/webhook';
const LEGACY_KLUMP_WOOCOMMERCE_WEBHOOK_PATH = '/wc-api/klp_wc_payment_webhook';
const CANONICAL_STOREFRONT_TERMS_PATH = '/terms';
const DEFAULT_POSTHOG_RELAY_PATH = '/baci-relay';
const RESERVED_POSTHOG_RELAY_PATH_PREFIXES = [
  '/api',
  '/_next',
  '/admin',
  '/auth',
  '/builder',
  '/checkout',
  '/dashboard',
  '/login',
  '/logout',
  '/track',
] as const;
const POSTHOG_RELAY_CREDENTIAL_HEADERS = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'referer',
  'x-csrf-token',
  'x-supabase-auth-token',
] as const;
const STATIC_ASSET_EXTENSION_REGEX =
  /\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot|css|js|json)$/i;
const POSTHOG_RELAY_PATH = normalizePostHogRelayPath(
  process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH
);
const LEGACY_STOREFRONT_TERMS_ALIAS_PATHS = new Set([
  '/terms-and-conditions',
  '/terms-of-service',
]);
const STOREFRONT_ROOT_SITEMAP_PATH = '/sitemap.xml';
const STOREFRONT_ROOT_SITEMAP_REWRITE_PATH = '/sitemap/root.xml';
const PUBLIC_MACHINE_READABLE_PATHS = new Set<string>([
  ...Object.values(STOREFRONT_AGENT_ROUTES),
  ...Object.values(STOREFRONT_FEED_ROUTES),
]);
const MERCHANT_CONTEXT_HEADERS = [
  'x-custom-domain',
  'x-merchant-domain',
  'x-merchant-slug',
] as const;
function appendVaryHeader(response: NextResponse, value: string): void {
  const currentValue = response.headers.get('Vary');
  const existingValues =
    currentValue?.split(',').map((entry) => entry.trim().toLowerCase()) ?? [];

  if (existingValues.includes(value.toLowerCase())) {
    return;
  }

  response.headers.set(
    'Vary',
    currentValue ? `${currentValue}, ${value}` : value
  );
}

function buildProxyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const header of MERCHANT_CONTEXT_HEADERS) {
    headers.delete(header);
  }
  headers.set(
    STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
    getStorefrontMetadataCacheBucket(request.headers.get('user-agent') ?? '')
  );
  return headers;
}

function buildPostHogRelayRequestHeaders(request: NextRequest): Headers {
  const headers = buildProxyRequestHeaders(request);
  for (const header of POSTHOG_RELAY_CREDENTIAL_HEADERS) {
    headers.delete(header);
  }
  return headers;
}

function setStorefrontMetadataCacheBucketSearchParam(
  url: URL,
  request: NextRequest
): void {
  url.searchParams.set(
    STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM,
    getStorefrontMetadataCacheBucket(request.headers.get('user-agent') ?? '')
  );
}

function normalizeStorefrontTermsAliasPath(pathname: string): string {
  const lookupPathname =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  return LEGACY_STOREFRONT_TERMS_ALIAS_PATHS.has(lookupPathname.toLowerCase())
    ? CANONICAL_STOREFRONT_TERMS_PATH
    : pathname;
}

function buildLegacyTermsAliasRedirectResponse(
  request: NextRequest,
  pathname: string,
  targetHostname?: string
): NextResponse | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return null;
  }

  const normalizedPathname = normalizeStorefrontTermsAliasPath(pathname);
  if (
    normalizedPathname === pathname ||
    normalizedPathname !== CANONICAL_STOREFRONT_TERMS_PATH
  ) {
    return null;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = normalizedPathname;

  if (targetHostname) {
    redirectUrl.protocol = 'https:';
    redirectUrl.hostname = targetHostname;
    redirectUrl.port = '';
  }

  return NextResponse.redirect(redirectUrl, 301);
}

function isPublicMachineReadablePath(pathname: string): boolean {
  return PUBLIC_MACHINE_READABLE_PATHS.has(pathname);
}

function normalizePostHogRelayPath(value?: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_POSTHOG_RELAY_PATH;
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized =
    withLeadingSlash.replace(/\/+$/, '') || DEFAULT_POSTHOG_RELAY_PATH;

  return isReservedPostHogRelayPath(normalized)
    ? DEFAULT_POSTHOG_RELAY_PATH
    : normalized;
}

function isReservedPostHogRelayPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return RESERVED_POSTHOG_RELAY_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

function isPostHogRelayPath(pathname: string): boolean {
  return (
    pathname === POSTHOG_RELAY_PATH ||
    pathname.startsWith(`${POSTHOG_RELAY_PATH}/`)
  );
}

function isStaticAssetOutsidePostHogRelay(pathname: string): boolean {
  return (
    /\/(?:static|array)\//.test(pathname) &&
    STATIC_ASSET_EXTENSION_REGEX.test(pathname) &&
    !isPostHogRelayPath(pathname)
  );
}

function isPlatformHost(hostname: string): boolean {
  return (
    isRootDomain(hostname, ROOT_DOMAIN) ||
    isVercelPreview(hostname) ||
    (isLocalhost(hostname) && extractLocalhostSubdomain(hostname) === null)
  );
}

// Pre-compiled regex patterns for performance (avoids recompilation on every request)
const STATIC_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|css|js|json)$/;
const IMAGE_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/;
const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i;
const PROTOCOL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const NESTED_PRODUCT_SUBROUTE_EXCLUSIONS = new Set(['best-under', 'compare']);
const PDP_HTML_CACHE_CONTROL = 'no-cache, no-store, max-age=0, must-revalidate';
const NON_CACHEABLE_STOREFRONT_HTML_CACHE_CONTROL =
  'private, no-store, max-age=0, must-revalidate';

// UUID-shaped product URL segment — resolved by the PDP route's id lookup, so
// the crawl-budget slug-set check (which holds slugs, not ids) must skip it.
const UUID_SHAPED_SLUG =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Decode a raw URL path segment for slug comparison. Path segments arrive
// percent-encoded while DB slugs are decoded; a malformed sequence (e.g. a lone
// `%`) throws — fall back to the raw value so a bad encoding never crashes the
// proxy (worst case: it simply won't match and falls through, never 404ing).
function safeDecodeSegment(segment: string | undefined): string {
  if (!segment) {
    return '';
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// True only for an internal request bearing the correct `INTERNAL_API_SECRET`
// (timing-safe). Used to scope the rate-limit exemption to AUTHENTICATED
// self-calls — an unauthenticated/forged request to `/api/internal/*` stays
// rate-limited, so the secret cannot be flooded/guessed without a 429.
function isAuthenticatedInternalRequest(request: NextRequest): boolean {
  const secret = getInternalApiSecret();
  if (!secret) {
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  return (
    Boolean(authHeader) &&
    constantTimeEqual(authHeader ?? '', `Bearer ${secret}`)
  );
}
// PDP documents are now safe to CDN-cache (see PR #2436 Next resume patch), so
// the prerendered PPR shell can be served from the edge for the LCP win.
const STOREFRONT_DOCUMENT_CACHE_CONTROL =
  's-maxage=300, stale-while-revalidate=3600';
const STOREFRONT_METADATA_CACHE_NON_HTML_EXTENSIONS_REGEX =
  /\.(?:json|jsonl|md|txt|webmanifest|xml)$/i;
const STOREFRONT_METADATA_CACHE_NON_HTML_SEGMENTS = new Set(['_next', 'api']);
const STOREFRONT_METADATA_CACHE_NON_HTML_ROUTE_SEGMENTS = new Set([
  'apple-icon',
  'icon',
  'opengraph-image',
  'twitter-image',
]);
const STOREFRONT_METADATA_CACHE_NON_SEO_SEGMENTS = new Set([
  'account',
  'cart',
  'checkout',
  'delete-account',
  'my-account',
  'order-success',
  'receipts',
  'track-order',
  'wallet',
  'wishlist',
]);
const PLATFORM_ROOT_ROUTE_SEGMENTS = new Set([
  '_next',
  'about',
  'admin',
  'api',
  'auth',
  'blog',
  'builder',
  'cart',
  'checkout',
  'contact',
  'debug-auth',
  'delete-account',
  'demo',
  'features',
  'favicon.ico',
  'feeds',
  'login',
  'manifest.webmanifest',
  'onboarding',
  'pricing',
  'privacy',
  'products',
  'reset-password',
  'robots.txt',
  'sitemap.xml',
  'template-preview',
  'terms',
  'track',
]);
// Matches blog index/post paths on both the platform root (`/blog`, `/blog/...`)
// and slug-prefixed storefront variants served from the root domain
// (`/{slug}/blog`, `/{slug}/blog/...`). Used to canonicalize thumbnail params.
// The negative lookahead excludes reserved top-level routes (API handlers,
// dashboard screens, etc.) that happen to have a `/blog` child segment —
// e.g. `/api/blog/posts` must reach its handler instead of being redirected.
const BLOG_PATH_REGEX =
  /^(?:\/(?!(?:api|dashboard|admin|auth|login|onboarding|builder|reset-password|checkout|cart|staff|invite|actions|about|contact|pricing|privacy|terms|features|developers|demo|debug-auth|template-preview|track|_next|sitemap\.xml|robots\.txt|manifest\.webmanifest|favicon\.ico)(?:\/|$))[^/]+)?\/blog(?:\/.*)?$/;

// Cache routing must classify the public URL shape, not the rewritten path:
// root/preview/plain-localhost storefronts are `/{slug}/...`, while custom
// domains and merchant subdomains start directly at the storefront content path.
function isSlugPrefixedStorefrontRequest(
  hostname: string | undefined
): boolean {
  return hostname ? isPlatformHost(hostname) : false;
}

function getStorefrontContentSegments(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): string[] {
  if (routeType !== 'storefront') {
    return [];
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  return isSlugPrefixedStorefrontRequest(hostname)
    ? pathSegments.slice(1)
    : pathSegments;
}

function normalizePathnameForCompare(pathname: string): string {
  return (pathname.replace(/\/+$/g, '') || '/').toLowerCase();
}

function getNestedProductSubrouteSegment(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): string | null {
  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  if (contentSegments.length !== 3) {
    return null;
  }

  return contentSegments[1] ?? null;
}

function isStorefrontNestedListingPath(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): boolean {
  const subrouteSegment = getNestedProductSubrouteSegment(
    pathname,
    hostname,
    routeType
  );
  return (
    subrouteSegment !== null &&
    NESTED_PRODUCT_SUBROUTE_EXCLUSIONS.has(subrouteSegment)
  );
}

function isStorefrontProductPagePath(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): boolean {
  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  if (contentSegments.length === 2) {
    return true;
  }

  const subrouteSegment = getNestedProductSubrouteSegment(
    pathname,
    hostname,
    routeType
  );
  if (subrouteSegment === null) {
    return false;
  }

  return !NESTED_PRODUCT_SUBROUTE_EXCLUSIONS.has(subrouteSegment);
}

function shouldPartitionStorefrontMetadataCache(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): boolean {
  if (routeType !== 'storefront') {
    return false;
  }

  const lowerPathname = pathname.toLowerCase();
  if (
    isPublicMachineReadablePath(pathname) ||
    STATIC_FILES_REGEX.test(lowerPathname) ||
    STOREFRONT_METADATA_CACHE_NON_HTML_EXTENSIONS_REGEX.test(lowerPathname)
  ) {
    return false;
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  if (isSlugPrefixedStorefrontRequest(hostname)) {
    const slugSegment = pathSegments[0]?.toLowerCase();
    if (
      !slugSegment ||
      !isValidSubdomain(slugSegment) ||
      RESERVED_SUBDOMAINS.has(slugSegment) ||
      RESERVED_STOREFRONT_SEGMENTS.has(slugSegment) ||
      PLATFORM_ROOT_ROUTE_SEGMENTS.has(slugSegment)
    ) {
      return false;
    }
  }

  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  const firstSegment = contentSegments[0]?.toLowerCase();

  if (
    firstSegment &&
    (STOREFRONT_METADATA_CACHE_NON_HTML_SEGMENTS.has(firstSegment) ||
      STOREFRONT_METADATA_CACHE_NON_SEO_SEGMENTS.has(firstSegment))
  ) {
    return false;
  }

  return !contentSegments.some((segment) =>
    STOREFRONT_METADATA_CACHE_NON_HTML_ROUTE_SEGMENTS.has(segment.toLowerCase())
  );
}

// Routes that should not be rewritten (main app routes)
const MAIN_APP_ROUTES = [
  '/dashboard',
  // '/api', // Allow API access on subdomains (controlled by middleware)
  '/auth',
  '/login',
  '/onboarding',
  '/builder',
  '/reset-password',
  POSTHOG_RELAY_PATH,
  '/_next',
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
  POSTHOG_RELAY_PATH,
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

// Public single-segment storefront documents that are safe to edge-cache for
// every tenant. Merchant-specific category roots belong in per-tenant sets.
const CACHEABLE_PUBLIC_STOREFRONT_FIRST_SEGMENTS = new Set([
  'about',
  'blog',
  'contact',
  'faq',
  'privacy',
  'privacy-policy',
  'products',
  'returns',
  'shipping',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
  'warranty',
]);

const STOREFRONT_CACHE_POLICIES_BY_SLUG = new Map<
  string,
  StorefrontPublicCachePolicy
>(
  STOREFRONT_PUBLIC_CACHE_POLICIES.map((policy) => [
    policy.slug.toLowerCase(),
    policy,
  ])
);
const STOREFRONT_CACHE_POLICIES_BY_HOSTNAME = new Map<
  string,
  StorefrontPublicCachePolicy
>(
  STOREFRONT_PUBLIC_CACHE_POLICIES.flatMap((policy) =>
    policy.customHostnames.map(
      (hostname) => [normalizeHostname(hostname), policy] as const
    )
  )
);
const CACHEABLE_PUBLIC_STOREFRONT_CATEGORY_SEGMENTS_BY_SLUG = new Map<
  string,
  Set<string>
>(
  STOREFRONT_PUBLIC_CACHE_POLICIES.map((policy) => [
    policy.slug.toLowerCase(),
    new Set<string>(
      policy.cacheableCategorySegments.map((segment) => segment.toLowerCase())
    ),
  ])
);

// First content segments that must NEVER be edge-cached as a public document.
// = RESERVED_STOREFRONT_SEGMENTS plus the per-user/authenticated route groups
// not already reserved: (customer) my-account/delete-account/receipts,
// (commerce) order-success, (utility) member-status/imei-check/quiz/reviews.
// Keep this in sync with the (customer)/(commerce)/(utility) route groups —
// caching any of these would leak per-user content (orders, receipts, etc.).
// The canonical PDP/category shape (`/<category>/<product>`) is intentionally
// NOT in this set, so it remains cacheable.
const NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS = new Set<string>([
  ...RESERVED_STOREFRONT_SEGMENTS,
  // Singular `/product/{slug}` is a legacy redirect-only / noindex route (not in
  // RESERVED, which only has plural `products`) — keep it no-store.
  'product',
  'my-account',
  'delete-account',
  'receipts',
  'order-success',
  'member-status',
  'imei-check',
  'quiz',
  'reviews',
]);

function isStorefrontHomeDocument(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): boolean {
  if (routeType !== 'storefront') {
    return false;
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  if (!isSlugPrefixedStorefrontRequest(hostname)) {
    return pathSegments.length === 0;
  }

  const slugSegment = pathSegments[0]?.toLowerCase();
  return (
    pathSegments.length === 1 &&
    slugSegment !== undefined &&
    isValidSubdomain(slugSegment) &&
    !RESERVED_SUBDOMAINS.has(slugSegment) &&
    !RESERVED_STOREFRONT_SEGMENTS.has(slugSegment) &&
    !PLATFORM_ROOT_ROUTE_SEGMENTS.has(slugSegment)
  );
}

function isNonHtmlStorefrontDocumentPath(pathname: string): boolean {
  const lowerPathname = pathname.toLowerCase();
  return (
    isPublicMachineReadablePath(pathname) ||
    STATIC_FILES_REGEX.test(lowerPathname) ||
    STOREFRONT_METADATA_CACHE_NON_HTML_EXTENSIONS_REGEX.test(lowerPathname) ||
    pathname
      .split('/')
      .filter(Boolean)
      .some((segment) =>
        STOREFRONT_METADATA_CACHE_NON_HTML_ROUTE_SEGMENTS.has(
          segment.toLowerCase()
        )
      )
  );
}

function getStorefrontSlugFromRequest(
  pathname: string,
  hostname: string | undefined
): string | null {
  if (!hostname) {
    return null;
  }

  const normalizedHostname = hostname ? normalizeHostname(hostname) : '';
  const customDomainPolicy =
    STOREFRONT_CACHE_POLICIES_BY_HOSTNAME.get(normalizedHostname);
  if (customDomainPolicy) {
    return customDomainPolicy.slug.toLowerCase();
  }

  const localhostSubdomain = extractLocalhostSubdomain(normalizedHostname);
  if (localhostSubdomain) {
    return localhostSubdomain;
  }

  const rootDomainSubdomain = extractSubdomain(normalizedHostname, ROOT_DOMAIN);
  if (rootDomainSubdomain && !RESERVED_SUBDOMAINS.has(rootDomainSubdomain)) {
    return rootDomainSubdomain;
  }

  if (!isSlugPrefixedStorefrontRequest(hostname)) {
    return null;
  }

  return pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? null;
}

function getStorefrontPublicCachePolicy(
  pathname: string,
  hostname: string | undefined
) {
  const storefrontSlug = getStorefrontSlugFromRequest(pathname, hostname);
  if (!storefrontSlug) {
    return null;
  }

  return STOREFRONT_CACHE_POLICIES_BY_SLUG.get(storefrontSlug) ?? null;
}

function isCacheablePublicStorefrontFirstSegment(
  pathname: string,
  hostname: string | undefined,
  firstSegment: string
): boolean {
  const cachePolicy = getStorefrontPublicCachePolicy(pathname, hostname);
  const cacheableCategorySegments = cachePolicy
    ? CACHEABLE_PUBLIC_STOREFRONT_CATEGORY_SEGMENTS_BY_SLUG.get(
        cachePolicy.slug.toLowerCase()
      )
    : undefined;

  return (
    CACHEABLE_PUBLIC_STOREFRONT_FIRST_SEGMENTS.has(firstSegment) ||
    cacheableCategorySegments?.has(firstSegment) === true
  );
}

function isPublicReservedStorefrontDocument(
  pathname: string,
  hostname: string | undefined,
  contentSegments: string[]
): boolean {
  const firstSegment = contentSegments[0]?.toLowerCase();
  if (
    firstSegment === undefined ||
    !isCacheablePublicStorefrontFirstSegment(pathname, hostname, firstSegment)
  ) {
    return false;
  }

  if (firstSegment === 'blog') {
    return true;
  }

  return contentSegments.length === 1;
}

function isCacheableSingleSegmentStorefrontDocument(
  pathname: string,
  hostname: string | undefined,
  contentSegments: string[]
): boolean {
  const firstSegment = contentSegments[0]?.toLowerCase();
  return (
    contentSegments.length === 1 &&
    firstSegment !== undefined &&
    isCacheablePublicStorefrontFirstSegment(pathname, hostname, firstSegment)
  );
}

// A storefront document is safe to CDN-cache only when it is anonymous public
// storefront HTML on a clean canonical URL. Per-user route groups and
// param/non-canonical URLs (for example invalid `?variantId=` that streams a
// redirect) are excluded so the edge never caches private or non-canonical
// content.
function isCacheablePublicStorefrontDocument(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api',
  hasQuery: boolean
): boolean {
  if (routeType !== 'storefront' || hasQuery) {
    return false;
  }
  if (isNonHtmlStorefrontDocumentPath(pathname)) {
    return false;
  }
  if (isStorefrontHomeDocument(pathname, hostname, routeType)) {
    return true;
  }

  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  if (contentSegments.length === 0) {
    return false;
  }

  const firstSegment = contentSegments[0]?.toLowerCase();
  if (
    firstSegment !== undefined &&
    NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS.has(firstSegment)
  ) {
    return (
      isPublicReservedStorefrontDocument(pathname, hostname, contentSegments) ||
      (firstSegment === 'products' &&
        isStorefrontProductPagePath(pathname, hostname, routeType))
    );
  }

  if (
    isCacheableSingleSegmentStorefrontDocument(
      pathname,
      hostname,
      contentSegments
    )
  ) {
    return true;
  }

  return isStorefrontProductPagePath(pathname, hostname, routeType);
}

function shouldSetStorefrontDocumentCacheControl(
  pathname: string,
  hostname: string | undefined,
  routeType: 'admin' | 'auth' | 'storefront' | 'api'
): boolean {
  if (
    routeType !== 'storefront' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api') ||
    isNonHtmlStorefrontDocumentPath(pathname)
  ) {
    return false;
  }

  if (
    isCacheablePublicStorefrontDocument(pathname, hostname, routeType, false)
  ) {
    return true;
  }

  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  const firstSegment = contentSegments[0]?.toLowerCase();

  return (
    contentSegments.length === 1 ||
    (firstSegment !== undefined &&
      NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS.has(firstSegment))
  );
}

function isSupabaseAuthCookieName(cookieName: string): boolean {
  const normalizedName = cookieName.toLowerCase();
  return (
    normalizedName === 'supabase-auth-token' ||
    normalizedName.startsWith('supabase-auth-token.') ||
    (normalizedName.startsWith('sb-') && normalizedName.includes('auth-token'))
  );
}

function hasStorefrontAuthSessionHint(
  request: NextRequest | undefined
): boolean {
  if (!request) {
    return true;
  }

  if (
    request.headers.has('x-supabase-auth-token') ||
    request.headers.has('authorization')
  ) {
    return true;
  }

  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.value.length > 0 && isSupabaseAuthCookieName(cookie.name)
    );
}

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

function normalizeCacheSafeStorefrontPathname(pathname: string): string | null {
  // Next remote cache currently serializes the request URL through ByteString
  // constrained headers. Keep this targeted to imported punctuation and apply
  // it on the raw URL path so existing escapes like %2F are preserved.
  const punctuationNormalizedPathname = pathname
    .split('/')
    .map((segment) =>
      segment
        .replace(CACHE_UNSAFE_ENCODED_DOUBLE_QUOTE_REGEX, '')
        .replace(CACHE_UNSAFE_ENCODED_SINGLE_QUOTE_REGEX, '')
        .replace(CACHE_UNSAFE_ENCODED_SPACE_OR_DASH_REGEX, '-')
        .replace(/[\u201c\u201d\u2033]/g, '')
        .replace(/[\u2018\u2019\u2032]/g, '')
        .replace(/[\u00a0\u2010-\u2015]/g, '-')
    )
    .join('/');

  if (punctuationNormalizedPathname === pathname) {
    return null;
  }

  const normalizedPathname = punctuationNormalizedPathname
    .split('/')
    .map((segment) => segment.replace(/-+/g, '-'))
    .join('/');

  return normalizedPathname || '/';
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

function isLegacyAnalyticsConversionPath(pathname: string): boolean {
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  return normalizedPathname.toLowerCase() === LEGACY_ANALYTICS_CONVERSION_PATH;
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
  const feedHeaders = buildProxyRequestHeaders(request);

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

function buildStorefrontRootSitemapRewriteResponse({
  request,
  pathname,
  userAgent,
  hostname,
  routeIdentifier,
  customDomain,
  merchantSlug,
}: {
  request: NextRequest;
  pathname: string;
  userAgent: string;
  hostname: string;
  routeIdentifier: string;
  customDomain?: string;
  merchantSlug?: string | null;
}): NextResponse {
  const sitemapUrl = request.nextUrl.clone();
  sitemapUrl.pathname = `/${routeIdentifier}${STOREFRONT_ROOT_SITEMAP_REWRITE_PATH}`;

  const sitemapHeaders = buildProxyRequestHeaders(request);
  if (customDomain) {
    sitemapHeaders.set('x-custom-domain', customDomain);
    sitemapHeaders.set('x-merchant-domain', customDomain);
  }
  if (merchantSlug) {
    sitemapHeaders.set('x-merchant-slug', merchantSlug);
  }

  const response = NextResponse.rewrite(sitemapUrl, {
    request: {
      headers: sitemapHeaders,
    },
  });

  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    'storefront',
    isLocalhost(hostname),
    undefined,
    request,
    hostname
  );
}

function buildStorefrontFaviconRewriteResponse({
  request,
  pathname,
  userAgent,
  hostname,
  routeIdentifier,
  customDomain,
  merchantSlug,
}: {
  request: NextRequest;
  pathname: string;
  userAgent: string;
  hostname: string;
  routeIdentifier: string;
  customDomain?: string;
  merchantSlug?: string | null;
}): NextResponse {
  const faviconUrl = request.nextUrl.clone();
  faviconUrl.pathname = `/${routeIdentifier}/favicon.ico`;

  const faviconHeaders = buildProxyRequestHeaders(request);
  if (customDomain) {
    faviconHeaders.set('x-custom-domain', customDomain);
    faviconHeaders.set('x-merchant-domain', customDomain);
  }
  if (merchantSlug) {
    faviconHeaders.set('x-merchant-slug', merchantSlug);
  }

  const response = NextResponse.rewrite(faviconUrl, {
    request: {
      headers: faviconHeaders,
    },
  });

  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    'storefront',
    isLocalhost(hostname),
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
            'script-src': `'self' 'unsafe-inline'${storefrontUnsafeEval} https://vercel.live https://va.vercel-scripts.com https://static.cloudflareinsights.com https://*.myhuaweicloud.com https://js.useklump.com https://asset.useklump.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://www.googletagservices.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://ad.doubleclick.net https://pubads.g.doubleclick.net https://tpc.googlesyndication.com https://cdn.ampproject.org https://*.adtrafficquality.google https://cm.g.doubleclick.net`,
            'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
            'connect-src':
              "'self' https://*.supabase.co https://vitals.vercel-insights.com https://cloudflareinsights.com https://checkout.useklump.com https://checkout-v2.useklump.com https://directdebit.useklump.com https://checkout.credpal.com https://api.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://googleads.g.doubleclick.net https://pubads.g.doubleclick.net https://cdn.ampproject.org https://cm.g.doubleclick.net",
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

/**
 * Build a real hard-status (404/410) storefront HTML response (PR-B §3.2).
 *
 * Under PPR a page-level `notFound()` only yields a soft-404 (200 + noindex)
 * because the static shell has already committed 200. Returning this from the
 * proxy gives crawlers a true status code. The body is minimal but valid HTML
 * (noindex), with full CSP/security headers applied and `Cache-Control:
 * no-store` set LAST so the cache section inside `applySecurityHeaders` can
 * never edge-cache a transient hard status.
 */
function buildHardStatusStorefrontResponse(
  status: 404 | 410,
  request: NextRequest,
  pathname: string,
  userAgent: string,
  hostname: string | undefined
): NextResponse {
  const title = status === 410 ? 'Page gone' : 'Page not found';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="robots" content="noindex, follow"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head><body style="font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center"><main><h1>${title}</h1><p>The page you’re looking for isn’t here. <a href="/">Go to the homepage</a>.</p></main></body></html>`;

  // HEAD must not carry a body (RFC 9110 §9.3.2); the noindex signal travels in
  // the X-Robots-Tag header below so a HEAD crawl still sees it.
  const body = request.method === 'HEAD' ? null : html;
  const response = new NextResponse(body, { status });
  response.headers.set('Content-Type', 'text/html; charset=utf-8');
  applySecurityHeaders(
    response,
    pathname,
    userAgent,
    'storefront',
    isLocalhost(hostname ?? ''),
    undefined,
    request,
    hostname
  );
  // Header-level noindex (belt-and-suspenders with the body <meta>): crawlers
  // that only HEAD, or don't parse the body, still get the directive.
  response.headers.set('X-Robots-Tag', 'noindex, follow');
  // no-store LAST: the cache section runs inside applySecurityHeaders and would
  // otherwise mark a product-shaped path cacheable, edge-caching a false 404.
  response.headers.set('Cache-Control', PDP_HTML_CACHE_CONTROL);
  return response;
}

/**
 * Crawl-budget pre-React status for storefront PDP product slugs (PR-B §3.2).
 *
 * Gated tightly to clean, non-prefetch, GET/HEAD HTML navigations to a
 * 2-segment PDP path (`/{category}/{productSlug}`). It asks the internal
 * slug-set route whether the product slug is active, redirectable legacy, or
 * absent. Redirectable archived aliases get a real 308 before the PDP route can
 * stream a 200; positively absent slugs get a hard 404. Every uncertain path
 * (params, RSC/prefetch, non-PDP shape, reserved segment, unavailable/empty
 * slug set) falls through — fail-open, so a live product is never 404'd.
 */
async function resolveStorefrontPdpHardNotFound(
  request: NextRequest,
  pathname: string,
  hostname: string | undefined,
  userAgent: string,
  identifier: string
): Promise<NextResponse | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return null;
  }
  // Param URLs should not become hard 404s, but redirectable legacy aliases
  // should still canonicalize while preserving attribution/search params.
  const hasSearchParams = request.nextUrl.search.length > 0;
  // Never hard-404 RSC/prefetch navigations Next expects to succeed.
  if (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-prefetch') ||
    request.headers.has('next-router-state-tree')
  ) {
    return null;
  }
  const fetchDest = request.headers.get('sec-fetch-dest')?.toLowerCase();
  if (fetchDest && fetchDest !== 'document') {
    return null;
  }

  const routeType = getRouteType(pathname);
  if (routeType !== 'storefront') {
    return null;
  }

  // Only the exact 2-segment PDP shape; category listings, nested subroutes
  // (compare/best-under), and reserved segments fall through.
  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  if (contentSegments.length !== 2) {
    return null;
  }
  // Path segments arrive percent-encoded (e.g. `dell-%E2%80%93-xps`); the DB
  // slug is decoded, so we MUST decode before comparing membership/reserved —
  // otherwise an encoded-but-real slug looks absent and gets falsely 404ed.
  const firstSegment = safeDecodeSegment(contentSegments[0]).toLowerCase();
  const productSlug = safeDecodeSegment(contentSegments[1]);
  // `/products/{slug}` (plural) is the categoryless PDP fallback that
  // getProductUrl emits and the `(pdp)/products/[productSlug]` route serves — a
  // real PDP surface, so it MUST be checked even though `products` is a reserved
  // first segment. (The singular `/product/{slug}` is a legacy redirect, not a
  // PDP, so it stays excluded below.)
  const isProductsFallbackPdp = firstSegment === 'products';
  // Otherwise the first segment must be a real category — non-PDP first segments
  // (blog, account, my-account, receipts, pages, cart, checkout, …) have their
  // own App Router pages (incl. `/my-account/[...path]` catch-alls) and must
  // never be hard-404ed. Use the BROADER non-cacheable first-segment set, not
  // just RESERVED, so authenticated route groups are excluded too.
  if (
    !isProductsFallbackPdp &&
    (!firstSegment || NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS.has(firstSegment))
  ) {
    return null;
  }
  if (
    !productSlug ||
    RESERVED_STOREFRONT_SEGMENTS.has(productSlug.toLowerCase())
  ) {
    return null;
  }
  // UUID product URLs (`/{category}/{productId}`) resolve through the page's
  // id-based lookup + canonical 308; the slug set only holds slugs, so a
  // UUID-shaped segment must never be hard-404ed.
  if (UUID_SHAPED_SLUG.test(productSlug)) {
    return null;
  }

  const resolution = await resolveStorefrontProductSlugResolution({
    origin: request.nextUrl.origin,
    identifier,
    productSlug,
    secret: getInternalApiSecret(),
  });

  if (resolution.kind === 'redirect') {
    const redirectUrl = request.nextUrl.clone();
    const redirectPath = isSlugPrefixedStorefrontRequest(hostname)
      ? `/${identifier}${resolution.redirectPath}`
      : resolution.redirectPath;
    redirectUrl.pathname = redirectPath;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (resolution.kind !== 'missing' || hasSearchParams) {
    return null;
  }

  return buildHardStatusStorefrontResponse(
    404,
    request,
    pathname,
    userAgent,
    hostname
  );
}

/**
 * Canonical PDP redirect for stale category aliases and archived variant slugs.
 *
 * This runs in proxy before the App Router/PPR page streams. Relying on
 * `permanentRedirect()` inside the streamed product route can produce a 200
 * noindex shell that only changes after JS/rendering in Semrush/Google-style
 * crawls. The internal endpoint performs the DB/cache lookup behind the
 * platform host and fails open on uncertainty.
 */
interface StorefrontPdpCanonicalRedirectResolution {
  response: NextResponse | null;
  skipHardNotFound: boolean;
}

async function resolveStorefrontPdpCanonicalRedirect(
  request: NextRequest,
  pathname: string,
  hostname: string | undefined,
  identifier: string,
  publicPathPrefix = ''
): Promise<StorefrontPdpCanonicalRedirectResolution> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return { response: null, skipHardNotFound: false };
  }
  if (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-prefetch') ||
    request.headers.has('next-router-state-tree')
  ) {
    return { response: null, skipHardNotFound: false };
  }
  const fetchDest = request.headers.get('sec-fetch-dest')?.toLowerCase();
  if (fetchDest && fetchDest !== 'document') {
    return { response: null, skipHardNotFound: false };
  }

  const routeType = getRouteType(pathname);
  if (routeType !== 'storefront') {
    return { response: null, skipHardNotFound: false };
  }

  const contentSegments = getStorefrontContentSegments(
    pathname,
    hostname,
    routeType
  );
  if (contentSegments.length !== 2) {
    return { response: null, skipHardNotFound: false };
  }

  const firstSegment = safeDecodeSegment(contentSegments[0]).toLowerCase();
  const productSlug = safeDecodeSegment(contentSegments[1]);
  const isProductsFallbackPdp = firstSegment === 'products';

  if (
    !isProductsFallbackPdp &&
    (!firstSegment || NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS.has(firstSegment))
  ) {
    return { response: null, skipHardNotFound: false };
  }
  if (
    !productSlug ||
    RESERVED_STOREFRONT_SEGMENTS.has(productSlug.toLowerCase())
  ) {
    return { response: null, skipHardNotFound: false };
  }
  const canonicalResult = await getStorefrontProductCanonicalRedirectResult({
    origin: request.nextUrl.origin,
    identifier,
    category: firstSegment,
    productSlug,
    secret: getInternalApiSecret(),
  });

  if (canonicalResult.kind === 'unknown') {
    return { response: null, skipHardNotFound: false };
  }

  if (canonicalResult.kind === 'checked-no-redirect') {
    return { response: null, skipHardNotFound: true };
  }

  const publicTargetPath = `${publicPathPrefix}${canonicalResult.redirectPath}`;
  if (
    normalizePathnameForCompare(publicTargetPath) ===
    normalizePathnameForCompare(pathname)
  ) {
    return { response: null, skipHardNotFound: true };
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = publicTargetPath;
  return {
    response: NextResponse.redirect(redirectUrl, 308),
    skipHardNotFound: true,
  };
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

function buildPostHogRelayPassThroughResponse(
  request: NextRequest,
  pathname: string,
  userAgent: string,
  hostname: string
): NextResponse {
  const requestHeaders = buildPostHogRelayRequestHeaders(request);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    'api',
    isLocalhost(hostname),
    undefined,
    request,
    hostname
  );
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

  if (isStaticAssetOutsidePostHogRelay(pathname)) {
    return NextResponse.next();
  }

  // ==== POSTHOG RELAY PASSTHROUGH ====
  // Let Next.js beforeFiles rewrites proxy PostHog ingest/assets on the same
  // merchant origin before URL canonicalization can redirect relay calls.
  if (isPostHogRelayPath(pathname)) {
    return buildPostHogRelayPassThroughResponse(
      request,
      pathname,
      userAgent,
      hostname
    );
  }

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

  const isLegacyAnalyticsConversionPost =
    isLegacyAnalyticsConversionPath(pathname) && request.method === 'POST';
  const isLegacyKlumpWebhook = isLegacyKlumpWooCommerceWebhookPath(pathname);
  const apiSecurityPathname = isLegacyKlumpWebhook
    ? KLUMP_WEBHOOK_API_PATH
    : isLegacyAnalyticsConversionPost
      ? ANALYTICS_CONVERSION_API_PATH
      : pathname;

  const noTrailingSlashPathname =
    isLegacyKlumpWebhook || isLegacyAnalyticsConversionPost
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
    // Internal, Bearer-authed self-calls (e.g. the proxy's own slug-set lookup
    // for the crawl-budget hard-404) must NOT count against the public per-IP
    // rate limiter — a crawler burst would otherwise 429 the internal fetch and
    // silently disable hard-404s for the window. ONLY exempt requests that carry
    // the valid internal secret; an unauthenticated/forged `/api/internal/*` hit
    // stays rate-limited so the secret cannot be flood-guessed without a 429.
    const isExemptInternalCall =
      apiSecurityPathname.startsWith('/api/internal/') &&
      isAuthenticatedInternalRequest(request);
    const rateLimitResult = isExemptInternalCall
      ? null
      : await checkRateLimit(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
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

  if (isLegacyAnalyticsConversionPost) {
    const conversionUrl = new URL(
      ANALYTICS_CONVERSION_API_PATH + request.nextUrl.search,
      request.url
    );

    const response = NextResponse.rewrite(conversionUrl);
    return applySecurityHeaders(
      response,
      ANALYTICS_CONVERSION_API_PATH,
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

  // ==== PLATFORM MACHINE-READABLE PASSTHROUGH ====
  // App-owned agent discovery routes such as /auth.md must reach App Router on
  // the root platform host. Otherwise the slug-based markdown mirror below can
  // mistake /auth.md for a merchant mirror and rewrite it to /api/llm/auth.md.
  if (isPlatformHost(hostname) && isPublicMachineReadablePath(pathname)) {
    return buildMerchantFeedPassThroughResponse({
      request,
      pathname,
      userAgent,
      hostname,
    });
  }

  // ==== LLM DISCOVERY PASSTHROUGH ====
  // Keep host-scoped llms files available on both the platform domain and
  // merchant storefront domains without proxy rewrites.
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return NextResponse.next();
  }

  // ==== INDEXNOW KEY FILE PASSTHROUGH ====
  // IndexNow validates ownership via a root-level `/<key>.txt` file. Keep the
  // platform key available on Baci-owned hosts here; registered custom domains
  // are handled after their merchant slug lookup so arbitrary hosts cannot
  // reuse the key.
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
  const isPlatformMarkdownHost = isPlatformHost(hostname);

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
  const rawPathname = new URL(request.url).pathname;
  const cacheSafeStorefrontPathname =
    normalizeCacheSafeStorefrontPathname(rawPathname);

  if (
    cacheSafeStorefrontPathname &&
    !isNonStorefrontPrefix &&
    !isStaticFile &&
    !isWellKnownPassthrough &&
    !isLlmsPassthrough
  ) {
    return NextResponse.redirect(
      new URL(
        cacheSafeStorefrontPathname + request.nextUrl.search,
        request.url
      ),
      308
    );
  }

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
      const normalizedRequestHost = normalizeHostname(hostname);
      const domain = normalizedRequestHost.replace(/^www\./, '');
      // Whether the ACTUAL request host carried the www. prefix (so the apex was
      // derived by stripping it). Scopes the www-counterpart auth-confirm
      // fallback below to genuine www requests only.
      const requestHostHadWww = normalizedRequestHost.startsWith('www.');
      const domainPathSegments = pathname.split('/').filter(Boolean);
      const domainMerchantSlug = await getSlugForCustomDomain(domain);

      if (pathname === '/favicon.ico') {
        return buildStorefrontFaviconRewriteResponse({
          request,
          pathname,
          userAgent,
          hostname,
          routeIdentifier: domainMerchantSlug ?? domain,
          customDomain: domain,
          merchantSlug: domainMerchantSlug,
        });
      }

      if (pathname === INDEXNOW_KEY_PATH && domainMerchantSlug) {
        const requestHeaders = buildProxyRequestHeaders(request);
        requestHeaders.set('x-custom-domain', domain);
        requestHeaders.set('x-merchant-domain', domain);
        requestHeaders.set('x-merchant-slug', domainMerchantSlug);

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }

      if (pathname === STOREFRONT_ROOT_SITEMAP_PATH) {
        // The dynamic storefront route tree can otherwise treat `sitemap.xml`
        // as a category segment. Keep the public URL stable while routing to
        // the request-aware XML route handler for 503/no-store support.
        return buildStorefrontRootSitemapRewriteResponse({
          request,
          pathname,
          userAgent,
          hostname,
          routeIdentifier: domainMerchantSlug ?? domain,
          customDomain: domain,
          merchantSlug: domainMerchantSlug,
        });
      }

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

      const directLegacyTermsAliasRedirect =
        buildLegacyTermsAliasRedirectResponse(request, pathname);
      if (directLegacyTermsAliasRedirect) {
        return directLegacyTermsAliasRedirect;
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
        const normalizedTermsAliasPathname =
          normalizeStorefrontTermsAliasPath(strippedPathname);
        // Only collapse `/merchantSlug/{category}/{productSlug}` to
        // `/products/{productSlug}` — i.e. exactly two stripped segments. Longer
        // paths can be legitimate category subroutes such as
        // `/{category}/compare/{comparisonSlug}` or `/{category}/best-under/{priceBandSlug}`
        // (see apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/compare
        // and .../best-under). Collapsing those to `/products/{lastSegment}`
        // would 301 merchants to URLs that don't exist.
        const shouldNormalizeToProductRoute =
          normalizedTermsAliasPathname === strippedPathname &&
          strippedSegments.length === 2 &&
          !!firstStrippedSegment &&
          !RESERVED_STOREFRONT_SEGMENTS.has(firstStrippedSegment);

        const normalizedPathname =
          normalizedTermsAliasPathname !== strippedPathname
            ? normalizedTermsAliasPathname
            : shouldNormalizeToProductRoute
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

        const apiHeaders = buildProxyRequestHeaders(request);
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
        const requestHeaders = buildProxyRequestHeaders(request);
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

      // Auth confirmation links (one-click magic-link / signup / recovery)
      // emitted for custom-domain storefronts point at
      // https://<custom-domain>/auth/confirm. Like /api, this route lives at
      // /auth/confirm (not /{domain}/auth/confirm), so pass it through instead
      // of storefront-rewriting it — otherwise the token never reaches the
      // verifier and the session cookie is never set on the custom domain.
      // Scoped to /auth/confirm only; the rest of /auth stays storefront-bound.
      if (
        pathname === '/auth/confirm' ||
        pathname.startsWith('/auth/confirm/')
      ) {
        // Only pass through for a REGISTERED merchant custom domain (unknown
        // hosts still get the storefront rewrite). `domain` has the www prefix
        // stripped, so a www-only registration leaves the apex slug null. Only
        // fall back to the www host when the REQUEST itself was on www. — never
        // promote an unregistered apex request just because the www counterpart
        // is registered (that would make a non-merchant host an auth-confirm
        // origin that receives session cookies).
        const confirmMerchantSlug =
          domainMerchantSlug ??
          (requestHostHadWww
            ? await getSlugForCustomDomain(normalizedRequestHost)
            : null);
        if (confirmMerchantSlug) {
          const requestHeaders = buildProxyRequestHeaders(request);
          requestHeaders.set('x-custom-domain', domain);
          requestHeaders.set('x-merchant-domain', domain);

          const response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          const routeType = getRouteType(pathname); // returns 'auth'
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
      }

      // Prevent redirect loop: if the path already starts with the domain,
      // it means we've already rewritten. Just let it pass through.
      // Use segment boundary check to avoid false positives (e.g., /shop.common matching /shop.com)
      const isAlreadyRewritten =
        pathname === `/${domain}` || pathname.startsWith(`/${domain}/`);

      if (isAlreadyRewritten) {
        // Already rewritten, just pass through with headers set
        const requestHeaders = buildProxyRequestHeaders(request);
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
      if (
        pathname.startsWith('/sitemap/') ||
        pathname === '/blog/sitemap.xml'
      ) {
        const sitemapUrl = request.nextUrl.clone();
        // Use merchant slug if found, otherwise fall through to domain-based rewrite
        sitemapUrl.pathname = `/${domainMerchantSlug ?? domain}${pathname}`;

        const sitemapHeaders = buildProxyRequestHeaders(request);
        sitemapHeaders.set('x-custom-domain', domain);
        sitemapHeaders.set('x-merchant-domain', domain);
        if (domainMerchantSlug) {
          sitemapHeaders.set('x-merchant-slug', domainMerchantSlug);
        }

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

          const mdHeaders = buildProxyRequestHeaders(request);
          mdHeaders.set('x-custom-domain', domain);
          mdHeaders.set('x-merchant-domain', domain);

          return NextResponse.rewrite(mdUrl, {
            request: { headers: mdHeaders },
          });
        }
        // Slug lookup failed — fall through to standard domain rewrite
      }

      const pdpCanonicalRedirect = await resolveStorefrontPdpCanonicalRedirect(
        request,
        pathname,
        hostname,
        domainMerchantSlug ?? domain
      );
      if (pdpCanonicalRedirect.response) {
        return pdpCanonicalRedirect.response;
      }

      // Crawl-budget hard-404 (PR-B §3.2): a confirmed-missing PDP product slug
      // gets a real 404 instead of a soft-404 shell. Fail-open; runs before the
      // storefront rewrite so a true typo never reaches the dynamic route.
      if (!pdpCanonicalRedirect.skipHardNotFound) {
        const pdpHardNotFound = await resolveStorefrontPdpHardNotFound(
          request,
          pathname,
          hostname,
          userAgent,
          domainMerchantSlug ?? domain
        );
        if (pdpHardNotFound) {
          return pdpHardNotFound;
        }
      }

      // First visit: Rewrite to /${domain}${pathname} so the storefront [slug] route handles it
      const url = request.nextUrl.clone();
      url.pathname = `/${domain}${pathname}`;
      const routeType = getRouteType(pathname);
      // Vercel/Next can overwrite configured HTML Vary for PPR responses; the
      // internal query param keeps empty-UA streamed shells out of browser cache
      // buckets without changing the public URL or canonical metadata.
      if (
        shouldPartitionStorefrontMetadataCache(pathname, hostname, routeType)
      ) {
        setStorefrontMetadataCacheBucketSearchParam(url, request);
      }

      const requestHeaders = buildProxyRequestHeaders(request);
      requestHeaders.set('x-custom-domain', domain);
      requestHeaders.set('x-merchant-domain', domain);

      const response = NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });

      // Generate route-specific CSP
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
    if (pathname === '/favicon.ico') {
      return buildStorefrontFaviconRewriteResponse({
        request,
        pathname,
        userAgent,
        hostname,
        routeIdentifier: subdomain,
        merchantSlug: subdomain,
      });
    }

    // Check if trying to access main app routes from subdomain - redirect to main domain
    if (MAIN_APP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL(pathname, `https://${ROOT_DOMAIN}`));
    }

    // ==== REDIRECT SUBDOMAIN TO CUSTOM DOMAIN ====
    // If merchant has a custom domain, redirect subdomain URLs to prevent duplicate content
    // Example: ogabassey.usebaci.com -> ogabassey.com
    let customDomain: string | null = null;
    if (!isLocalhost(hostname)) {
      customDomain = await getCustomDomainForSlug(subdomain);
      const legacyTermsAliasRedirect = buildLegacyTermsAliasRedirectResponse(
        request,
        pathname,
        customDomain ?? undefined
      );
      if (legacyTermsAliasRedirect) {
        return legacyTermsAliasRedirect;
      }
      if (customDomain) {
        const customDomainUrl = `https://${customDomain}${pathname}${request.nextUrl.search}`;
        return NextResponse.redirect(customDomainUrl, 301);
      }
    } else {
      const legacyTermsAliasRedirect = buildLegacyTermsAliasRedirectResponse(
        request,
        pathname
      );
      if (legacyTermsAliasRedirect) {
        return legacyTermsAliasRedirect;
      }
    }

    // Rewrite subdomain requests to path-based storefront routes
    // ogabassey.usebaci.com/smartphones/iphone-12 -> /ogabassey/smartphones/iphone-12

    // ==== FIX: API Routes on Subdomains ====
    // Do NOT rewrite API routes to /[subdomain]/api/...
    // Instead, pass them through with headers
    if (pathname.startsWith('/api')) {
      const requestHeaders = buildProxyRequestHeaders(request);
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

    if (pathname === STOREFRONT_ROOT_SITEMAP_PATH) {
      return buildStorefrontRootSitemapRewriteResponse({
        request,
        pathname,
        userAgent,
        hostname,
        routeIdentifier: subdomain,
        merchantSlug: subdomain,
      });
    }

    // LLM markdown mirrors: rewrite .md paths to /api/llm/ to avoid
    // route collisions with dynamic [category] segments in the storefront tree.
    if (pathname.endsWith('.md')) {
      const mdUrl = request.nextUrl.clone();
      mdUrl.pathname = toLlmApiPath(pathname, subdomain as string);

      const mdHeaders = buildProxyRequestHeaders(request);
      mdHeaders.set('x-merchant-slug', subdomain as string);

      return NextResponse.rewrite(mdUrl, {
        request: { headers: mdHeaders },
      });
    }

    const subdomainPdpCanonicalRedirect =
      await resolveStorefrontPdpCanonicalRedirect(
        request,
        pathname,
        hostname,
        subdomain as string
      );
    if (subdomainPdpCanonicalRedirect.response) {
      return subdomainPdpCanonicalRedirect.response;
    }

    // Crawl-budget hard-404 (PR-B §3.2) for SUBDOMAIN storefronts
    // (`{slug}.usebaci.com/{category}/{product}`). Same fail-open guard as the
    // custom-domain branch; identifier is the subdomain. The subdomain host is
    // not a platform host, so content segments are not slug-sliced here.
    if (!subdomainPdpCanonicalRedirect.skipHardNotFound) {
      const subdomainPdpHardNotFound = await resolveStorefrontPdpHardNotFound(
        request,
        pathname,
        hostname,
        userAgent,
        subdomain as string
      );
      if (subdomainPdpHardNotFound) {
        return subdomainPdpHardNotFound;
      }
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    const routeType = getRouteType(pathname);
    if (shouldPartitionStorefrontMetadataCache(pathname, hostname, routeType)) {
      setStorefrontMetadataCacheBucketSearchParam(url, request);
    }

    const requestHeaders = buildProxyRequestHeaders(request);
    requestHeaders.set('x-merchant-slug', subdomain as string);

    const response = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });

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
          const normalizedPathname =
            normalizeStorefrontTermsAliasPath(newPathname);
          const customDomainUrl = `https://${customDomain}${normalizedPathname}${request.nextUrl.search}`;
          return NextResponse.redirect(customDomainUrl, 301);
        }
      }
    }
  }

  if (
    (isRootDomain(hostname, ROOT_DOMAIN) || isVercelPreview(hostname)) &&
    !isLocalhost(hostname)
  ) {
    const pathSegments = pathname.split('/').filter(Boolean);
    if (
      pathSegments.length === 2 &&
      pathSegments[1]?.toLowerCase() === 'sitemap.xml' &&
      isValidSubdomain(pathSegments[0]) &&
      !RESERVED_SUBDOMAINS.has(pathSegments[0])
    ) {
      return buildStorefrontRootSitemapRewriteResponse({
        request,
        pathname,
        userAgent,
        hostname,
        routeIdentifier: pathSegments[0],
        merchantSlug: pathSegments[0],
      });
    }
  }

  // Crawl-budget hard-404 (PR-B §3.2) for slug-prefixed root-domain / preview
  // storefronts (`usebaci.com/{slug}/{category}/{product}`). Runs AFTER the
  // slug→custom-domain redirect above (so a slug with a custom domain 301s
  // instead of 404ing) and is gated to real storefront slugs — never main-app
  // routes. Platform hosts are slug-prefixed, so the helper strips the slug and
  // judges `{category}/{product}`. Fail-open as everywhere else.
  if (
    (isRootDomain(hostname, ROOT_DOMAIN) || isVercelPreview(hostname)) &&
    !isLocalhost(hostname)
  ) {
    const pathSegments = pathname.split('/').filter(Boolean);
    const slug = pathSegments[0];
    const isMainAppRoute =
      ROOT_DOMAIN_ONLY_MAIN_APP_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      ) || MAIN_APP_ROUTES.some((route) => pathname.startsWith(route));
    if (
      slug &&
      !isMainAppRoute &&
      // Platform-owned root segments (about, pricing, products, blog, …) are not
      // storefront slugs — never run the membership check (or send the secret)
      // for them, even though they pass the generic subdomain-shape test.
      !PLATFORM_ROOT_ROUTE_SEGMENTS.has(slug.toLowerCase()) &&
      isValidSubdomain(slug) &&
      !RESERVED_SUBDOMAINS.has(slug)
    ) {
      const rootPdpCanonicalRedirect =
        await resolveStorefrontPdpCanonicalRedirect(
          request,
          pathname,
          hostname,
          slug,
          `/${slug}`
        );
      if (rootPdpCanonicalRedirect.response) {
        return rootPdpCanonicalRedirect.response;
      }

      if (!rootPdpCanonicalRedirect.skipHardNotFound) {
        const rootPdpHardNotFound = await resolveStorefrontPdpHardNotFound(
          request,
          pathname,
          hostname,
          userAgent,
          slug
        );
        if (rootPdpHardNotFound) {
          return rootPdpHardNotFound;
        }
      }
    }
  }

  // Standard request - generate route-specific CSP
  const routeType = getRouteType(pathname);
  const isLocal = isLocalhost(hostname);

  if (shouldPartitionStorefrontMetadataCache(pathname, hostname, routeType)) {
    // Root-domain and preview storefront PDPs do not hit the custom-domain or
    // subdomain rewrite branches above, so apply the same hidden partition key
    // here instead of relying only on a Vary header that Next/Vercel may replace.
    const url = request.nextUrl.clone();
    setStorefrontMetadataCacheBucketSearchParam(url, request);

    const response = NextResponse.rewrite(url, {
      request: {
        headers: buildProxyRequestHeaders(request),
      },
    });

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
  // Storefront checkout embeds the Credit Direct BNPL flow in an in-page iframe
  // (see CSP frame-src) that runs camera-based identity verification. A blanket
  // `camera=()` allowlist disables the camera for the page AND every nested
  // iframe, so getUserMedia is hard-blocked before the browser can prompt.
  //
  // Per the Permissions Policy spec, a cross-origin iframe only gets a feature
  // if the embedding document has it enabled for its OWN origin — i.e. `self`
  // MUST be in the allowlist, otherwise delegation to the listed origins fails.
  // So we grant `self` plus the Credit Direct verification origins (live + the
  // cdl.test.lendastack.io test host used when isLive=false, matching the CSP
  // frame-src allowlist).
  //
  // To avoid handing camera/mic to every storefront page (getRouteType() buckets
  // all marketing/product/category pages as "storefront"), this is scoped to
  // checkout paths only. Everywhere else stays fully disabled.
  const isCheckoutRoute =
    routeType === 'storefront' && /\/checkout(\/|$)/.test(pathname);
  const cameraAllowlist = isCheckoutRoute
    ? 'camera=(self "https://checkout.creditdirect.ng" "https://app.creditdirect.ng" "https://cdl.test.lendastack.io"), microphone=(self "https://checkout.creditdirect.ng" "https://app.creditdirect.ng" "https://cdl.test.lendastack.io")'
    : 'camera=(), microphone=()';
  response.headers.set(
    'Permissions-Policy',
    `${cameraAllowlist}, geolocation=(), browsing-topics=()`
  );

  // Set x-nonce header for server components (admin/auth routes only)
  // 2026 pattern: Also include it in the response so it's visible in dev tools / debug
  if (nonce) {
    response.headers.set('x-nonce', nonce);
  }

  // Set pathname header for server components to detect current route
  response.headers.set('x-pathname', pathname);

  if (routeType === 'storefront') {
    // Defense in depth for direct middleware responses. Rewritten PPR HTML can
    // overwrite Vary later, so product-like rewrites also carry the internal
    // metadata bucket query param set before Next renders the route.
    appendVaryHeader(response, STOREFRONT_METADATA_CACHE_BUCKET_HEADER);
  }

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
    (pathname.startsWith('/_next/static') ||
      pathname.startsWith('/images') ||
      pathname.match(IMAGE_FILES_REGEX)) &&
    pathname !== '/favicon.ico'
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

  // Keep SEO listing subroutes cacheable; they share the 3-segment shape used
  // by category PDPs but do not stream PDP metadata/content slots.
  if (isStorefrontNestedListingPath(pathname, hostname, routeType)) {
    const hasQuery = request ? request.nextUrl.search.length > 0 : true;
    const hasAuthSessionHint = hasStorefrontAuthSessionHint(request);

    if (hasQuery || hasAuthSessionHint) {
      response.headers.set(
        'Cache-Control',
        NON_CACHEABLE_STOREFRONT_HTML_CACHE_CONTROL
      );
      if (hasAuthSessionHint) {
        appendVaryHeader(response, 'Cookie');
      }
      return response;
    }

    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=1800, stale-while-revalidate=7200'
        : 's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Storefront HTML documents. Public anonymous documents get a short CDN TTL:
  // home, catalog/category listings, canonical PDPs, public blog pages, and
  // static trust/content pages. Per-user route groups like account, checkout,
  // cart, wallet, receipts, and order-success MUST stay no-store so the edge
  // never caches private or non-canonical content.
  if (shouldSetStorefrontDocumentCacheControl(pathname, hostname, routeType)) {
    // Fail safe: if the request is unavailable we cannot confirm the URL is
    // param-free, so treat it as having a query (not cacheable).
    const hasQuery = request ? request.nextUrl.search.length > 0 : true;
    const hasAuthSessionHint = hasStorefrontAuthSessionHint(request);
    const cacheable =
      !hasAuthSessionHint &&
      isCacheablePublicStorefrontDocument(
        pathname,
        hostname,
        routeType,
        hasQuery
      );
    response.headers.set(
      'Cache-Control',
      hasAuthSessionHint || !cacheable
        ? NON_CACHEABLE_STOREFRONT_HTML_CACHE_CONTROL
        : STOREFRONT_DOCUMENT_CACHE_CONTROL
    );
    if (hasAuthSessionHint) {
      appendVaryHeader(response, 'Cookie');
    }
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
    // Next statically analyzes matcher values. Keep this literal in sync with
    // DEFAULT_POSTHOG_RELAY_PATH so relay static assets do not bypass header
    // stripping just because they end in .js/.css/.json.
    '/baci-relay/:path*',
    // Custom relay paths are runtime-configurable, while matcher values are
    // statically analyzed. Catch custom `/relay/static/*.js` and
    // `/relay/array/*.js` assets, but keep Next's own static chunks out of
    // middleware so critical JS/CSS does not pay proxy overhead on every page.
    '/((?!_next/static(?:/|$))(?:.+/)?(?:static|array)/.*)',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (SEO file)
     * - ads.txt (host-aware Route Handler at app/ads.txt; bypasses middleware
     *   so it receives the original Host on every domain — same as robots.txt)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/image(?:/.*[^/])?$|_next/static(?:/.*[^/])?$|manifest\\.webmanifest$|robots\\.txt$|ads\\.txt$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot|css|js|json)$|(?!favicon\\.ico$)(?!favicon\\.ico/$).+\\.ico$).*)',
  ],
};
