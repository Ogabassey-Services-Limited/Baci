import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  CLICK_ID_PARAMS,
  extractClickIdsFromUrl,
  generateClickIdCookies,
} from '@/lib/ad-tracking-cookies';
import { updateSession } from '@/lib/supabase/middleware';

// Root domain - merchants get subdomains like ogabassey.usebaci.com
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

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
    normalizedHost === `www.${normalizedRoot}`
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
  nonce?: string
): string {
  const baseDirectives = {
    'default-src': "'self'",
    'img-src': "'self' blob: data: https:",
    'font-src': "'self' data: https://fonts.gstatic.com",
    'object-src': "'none'",
    'base-uri': "'self'",
    'upgrade-insecure-requests': '',
  };

  if (routeType === 'admin' || routeType === 'auth') {
    // Strict nonce-based CSP for admin and authentication routes
    return Object.entries({
      ...baseDirectives,
      // strict-dynamic allows nonced scripts to load additional scripts dynamically (CSP Level 3)
      'script-src': `'self' 'nonce-${nonce}' 'strict-dynamic' https://vercel.live https://va.vercel-scripts.com`,
      'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
      'connect-src':
        "'self' https://*.supabase.co wss://*.supabase.co https://api.korapay.com https://generativelanguage.googleapis.com https://vercel.live https://vitals.vercel-insights.com",
      'frame-src': "'self' https://checkout.korapay.com",
      'form-action': "'self'",
      'frame-ancestors': "'self'",
    })
      .map(([key, value]) => `${key} ${value}`.trim())
      .join('; ');
  }

  if (routeType === 'storefront') {
    // Relaxed CSP for merchant storefronts (allows ISR/SSG)
    return Object.entries({
      ...baseDirectives,
      'script-src':
        "'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
      'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
      'connect-src':
        "'self' https://*.supabase.co https://vitals.vercel-insights.com",
    })
      .map(([key, value]) => `${key} ${value}`.trim())
      .join('; ');
  }

  // Basic CSP for API routes
  return Object.entries({
    'default-src': "'self'",
    'object-src': "'none'",
  })
    .map(([key, value]) => `${key} ${value}`.trim())
    .join('; ');
}

/**
 * Next.js Middleware Function
 * Handles multi-tenant routing, security headers, caching, and authentication
 */
export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  // console.log('[Middleware] Request:', pathname);
  const userAgent = request.headers.get('user-agent') || '';

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
    const { supabaseResponse, user } = await updateSession(request);

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
      return NextResponse.redirect(url);
    }

    // Auth routes: redirect to dashboard if already logged in
    if (isAuthRoute && user) {
      // console.log('Middleware: User found on auth route, redirecting to dashboard');
      const redirectTo = request.nextUrl.searchParams.get('redirectTo');
      const url = request.nextUrl.clone();
      url.pathname = redirectTo || '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // For protected routes, apply security headers to the supabase response
    if (isProtectedRoute) {
      const routeType = getRouteType(pathname);
      const nonce =
        routeType === 'admin' || routeType === 'auth'
          ? crypto.randomUUID()
          : undefined;
      return applySecurityHeaders(
        supabaseResponse,
        pathname,
        userAgent,
        routeType,
        nonce
      );
    }
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
      const domain = normalizeHostname(hostname);

      // Prevent redirect loop: if the path already starts with the domain,
      // it means we've already rewritten. Just let it pass through.
      // Use segment boundary check to avoid false positives (e.g., /shop.common matching /shop.com)
      const isAlreadyRewritten =
        pathname === `/${domain}` || pathname.startsWith(`/${domain}/`);

      if (isAlreadyRewritten) {
        // Already rewritten, just pass through with headers set
        const response = NextResponse.next();
        response.headers.set('x-custom-domain', domain);
        response.headers.set('x-merchant-domain', domain);

        const routeType = getRouteType(pathname);
        const nonce =
          routeType === 'admin' || routeType === 'auth'
            ? crypto.randomUUID()
            : undefined;

        return applySecurityHeaders(
          response,
          pathname,
          userAgent,
          routeType,
          nonce,
          request
        );
      }

      // First visit: Rewrite to /${domain}${pathname} so the storefront [slug] route handles it
      const url = request.nextUrl.clone();
      url.pathname = `/${domain}${pathname}`;

      const response = NextResponse.rewrite(url);
      response.headers.set('x-custom-domain', domain);
      response.headers.set('x-merchant-domain', domain);

      // Generate route-specific CSP
      const routeType = getRouteType(pathname);
      const nonce =
        routeType === 'admin' || routeType === 'auth'
          ? crypto.randomUUID()
          : undefined;

      return applySecurityHeaders(
        response,
        pathname,
        userAgent,
        routeType,
        nonce,
        request // Pass request for click ID capture on storefront
      );
    } else {
      // Invalid/suspicious hostname - reject
      return new NextResponse('Bad Request', { status: 400 });
    }
  }

  // If we have a valid subdomain (not reserved), rewrite to storefront routes
  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    // Check if trying to access main app routes from subdomain - redirect to main domain
    if (MAIN_APP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL(pathname, `https://${ROOT_DOMAIN}`));
    }

    // Rewrite subdomain requests to path-based storefront routes
    // ogabassey.usebaci.com/smartphones/iphone-12 -> /ogabassey/smartphones/iphone-12
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;

    const response = NextResponse.rewrite(url);
    response.headers.set('x-merchant-slug', subdomain);

    // Generate route-specific CSP
    const routeType = getRouteType(pathname);
    const nonce =
      routeType === 'admin' || routeType === 'auth'
        ? crypto.randomUUID()
        : undefined;

    return applySecurityHeaders(
      response,
      pathname,
      userAgent,
      routeType,
      nonce,
      request // Pass request for click ID capture on storefront
    );
  }

  // Standard request - generate route-specific CSP
  const response = NextResponse.next();
  const routeType = getRouteType(pathname);
  const nonce =
    routeType === 'admin' || routeType === 'auth'
      ? crypto.randomUUID()
      : undefined;

  return applySecurityHeaders(
    response,
    pathname,
    userAgent,
    routeType,
    nonce,
    request // Pass request for click ID capture on storefront
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
  nonce?: string,
  request?: NextRequest
): NextResponse {
  // Capture ad click IDs from URL params (if request provided)
  if (request && routeType === 'storefront') {
    captureAdClickIds(request, response);
  }

  // Apply Content Security Policy
  const csp = generateCSP(routeType, nonce);
  response.headers.set('Content-Security-Policy', csp);

  // Set nonce in request header for server components (admin/auth routes only)
  if (nonce) {
    response.headers.set('x-nonce', nonce);
  }

  // HSTS: Enforce HTTPS with subdomains and preload (Lighthouse Best Practice)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // COOP: Isolate top-level window from cross-origin documents (Lighthouse Best Practice)
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // COEP: Cross-Origin Embedder Policy for SharedArrayBuffer support
  // Note: 'credentialless' is more compatible than 'require-corp'
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

  // Detect bots/crawlers for optimized SEO caching
  const isBot =
    /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i.test(
      userAgent
    );

  // Add cache headers for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)
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
    pathname.match(/^\/[^/]+\/products\/[^/]+$/) ||
    pathname.match(/^\/[^/]+\/[^/]+\/[^/]+$/)
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
    pathname.match(/^\/[^/]+\/[^/]+\/?$/) &&
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
    pathname.match(/^\/[^/]+\/?$/) &&
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
     * - api (all API routes - they handle their own auth)
     * - manifest.webmanifest (PWA manifest)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/image|_next/static|favicon.ico|api/|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js|json)$).*)',
  ],
};
