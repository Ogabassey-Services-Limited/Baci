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

// Pre-compiled regex patterns for performance (avoids recompilation on every request)
const STATIC_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|css|js|json)$/;
const IMAGE_FILES_REGEX =
  /\.(jpg|jpeg|png|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/;
const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i;
const PRODUCT_PAGE_REGEX = /^\/[^/]+\/products\/[^/]+$/;
const NESTED_PRODUCT_REGEX = /^\/[^/]+\/[^/]+\/[^/]+$/;
const CATEGORY_PAGE_REGEX = /^\/[^/]+\/[^/]+\/?$/;
const STOREFRONT_HOME_REGEX = /^\/[^/]+\/?$/;
// Matches blog index/post paths on both the platform root (`/blog`, `/blog/...`)
// and slug-prefixed storefront variants served from the root domain
// (`/{slug}/blog`, `/{slug}/blog/...`). Used to canonicalize thumbnail params.
const BLOG_PATH_REGEX = /^(?:\/[^/]+)?\/blog(?:\/.*)?$/;

// Routes that should not be rewritten (main app routes)
const MAIN_APP_ROUTES = [
  '/dashboard',
  // '/api', // Allow API access on subdomains (controlled by middleware)
  '/auth',
  '/login',
  '/onboarding',
  '/checkout',
  '/builder',
  '/reset-password',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.webmanifest',
];

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
          // 2026 Next.js 16 Caveat: 'strict-dynamic' requires ALL scripts to be nonced.
          // Since Next.js internal chunks are not easily nonced in App Router, we use a
          // strict policy that allows 'self' and 'unsafe-inline' (for framework tags)
          // but still nonces our own custom scripts.
          'script-src': `'self' 'nonce-${nonce}' 'unsafe-inline'${isLocal ? " 'unsafe-eval'" : ''} https://vercel.live https://va.vercel-scripts.com`,
          'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
          'connect-src':
            "'self' https://*.supabase.co wss://*.supabase.co https://api.korapay.com https://generativelanguage.googleapis.com https://vercel.live https://vitals.vercel-insights.com https://helpdesk.usebaci.com",
          'frame-src': "'self' https://checkout.korapay.com",
          'form-action': "'self'",
        }
      : routeType === 'storefront'
        ? {
            ...baseDirectives,
            'script-src':
              "'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://*.myhuaweicloud.com https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://www.googletagservices.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://ad.doubleclick.net https://pubads.g.doubleclick.net https://tpc.googlesyndication.com https://cdn.ampproject.org https://*.adtrafficquality.google https://cm.g.doubleclick.net",
            'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
            'connect-src':
              "'self' https://*.supabase.co https://vitals.vercel-insights.com https://checkout.credpal.com https://api.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://securepubads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://googleads.g.doubleclick.net https://pubads.g.doubleclick.net https://cdn.ampproject.org https://cm.g.doubleclick.net",
            'frame-src':
              "'self' https://checkout.credpal.com https://checkout.creditdirect.ng https://app.creditdirect.ng https://cdl.test.lendastack.io https://googleads.g.doubleclick.net https://*.safeframe.googlesyndication.com https://tpc.googlesyndication.com https://td.doubleclick.net https://www.google.com https://cdn.ampproject.org https://*.adtrafficquality.google https://ep2.adtrafficquality.google https://cm.g.doubleclick.net https://securepubads.g.doubleclick.net",
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

  // ==== RATE LIMITING (API Routes) ====
  // Protect API endpoints from abuse
  if (pathname.startsWith('/api')) {
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
      const isWebhook = pathname.startsWith('/api/webhooks/');

      // Skip: Auth callback routes — called by OAuth providers.
      const isAuthCallback = pathname.startsWith('/api/auth/');

      // Skip: Cron endpoints — called by Vercel cron, not browsers.
      const isCron = pathname.startsWith('/api/cron/');

      // Skip: Public analytics endpoint
      const isPublicAnalytics = pathname === '/api/platform/events';

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
  if (pathname.startsWith('/blog/')) {
    const spamPatterns = [
      '/blog/shopdetail',
      '/blog/zhhant',
      '/blog/product',
      '/blog/category/product',
    ];
    if (
      spamPatterns.some((pattern) => pathname.toLowerCase().startsWith(pattern))
    ) {
      return new NextResponse('Gone', { status: 410 });
    }
  }

  // ==== SEO: STRIP THUMBNAIL QUERY NOISE ====
  // WordPress/share tooling can append `thumbnail_id` or `_thumbnail_id`
  // to blog URLs. These params should not produce unique crawlable URLs.
  // Covers the platform blog (`/blog`, `/blog/...`) and storefront variants
  // served from the root domain (`/{slug}/blog`, `/{slug}/blog/...`).
  if (
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
  if (pathname.startsWith('/.well-known/')) {
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
  if (
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
    // Generate Nonce EARLY for CSP (Request Header Injection)
    // 2026 Best Practice: Next.js reads 'x-nonce' from request headers to authorize internal scripts
    const routeType = getRouteType(pathname);
    const isLocal = isLocalhost(hostname);
    const nonce = crypto.randomUUID();

    // Prepare request headers with nonce
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

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
      url.searchParams.set('redirectTo', pathname);
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
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const url = request.nextUrl.clone();
      url.pathname = redirectTo || '/dashboard';
      url.search = '';
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

      // API routes should NOT be rewritten - they exist at /api/*, not /domain/api/*
      // This fixes 405 errors when calling APIs from custom domains
      // API routes should NOT be rewritten - they exist at /api/*, not /domain/api/*
      // This fixes 405 errors when calling APIs from custom domains
      if (pathname.startsWith('/api')) {
        const requestHeaders = new Headers(request.headers);
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
        const requestHeaders = new Headers(request.headers);
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
        const merchantSlug = await getSlugForCustomDomain(domain);
        const sitemapUrl = request.nextUrl.clone();
        // Use merchant slug if found, otherwise fall through to domain-based rewrite
        sitemapUrl.pathname = `/${merchantSlug ?? domain}${pathname}`;

        const sitemapHeaders = new Headers(request.headers);
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
        const merchantSlug = await getSlugForCustomDomain(domain);
        if (merchantSlug) {
          const mdUrl = request.nextUrl.clone();
          mdUrl.pathname = toLlmApiPath(pathname, merchantSlug);

          const mdHeaders = new Headers(request.headers);
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

      const requestHeaders = new Headers(request.headers);
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
      const requestHeaders = new Headers(request.headers);
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

    // LLM markdown mirrors: rewrite .md paths to /api/llm/ to avoid
    // route collisions with dynamic [category] segments in the storefront tree.
    if (pathname.endsWith('.md')) {
      const mdUrl = request.nextUrl.clone();
      mdUrl.pathname = toLlmApiPath(pathname, subdomain as string);

      const mdHeaders = new Headers(request.headers);
      mdHeaders.set('x-merchant-slug', subdomain as string);

      return NextResponse.rewrite(mdUrl, {
        request: { headers: mdHeaders },
      });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;

    const requestHeaders = new Headers(request.headers);
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
    if (
      pathSegments.length >= 1 &&
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
  const response = NextResponse.next();
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/image|_next/static|favicon.ico|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|eot|css|js|json)$).*)',
  ],
};
