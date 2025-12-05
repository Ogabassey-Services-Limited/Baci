import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
 * Check if this is localhost/development environment
 */
function isLocalhost(hostname: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1';
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
      'script-src': `'self' 'nonce-${nonce}' 'strict-dynamic' https://maps.googleapis.com https://vercel.live https://va.vercel-scripts.com`,
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
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // ==== AUTH MIDDLEWARE (Server-side session verification) ====
  // For protected routes, verify auth BEFORE rendering
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/admin');

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/reset-password';

  // Only run auth check for protected or auth routes (skip for public routes)
  if (isProtectedRoute || isAuthRoute) {
    const { supabaseResponse, user } = await updateSession(request);

    // Protected routes: redirect to login if no user
    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }

    // Auth routes: redirect to dashboard if already logged in
    if (isAuthRoute && user) {
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
    // In development, use path-based routing: localhost:3000/ogabassey/...
    // The (storefront)/[slug] routes handle this
    subdomain = null;
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
      // Let the page resolve merchant by domain lookup
      const response = NextResponse.next();
      response.headers.set('x-custom-domain', normalizeHostname(hostname));

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
        nonce
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
      nonce
    );
  }

  // Standard request - generate route-specific CSP
  const response = NextResponse.next();
  const routeType = getRouteType(pathname);
  const nonce =
    routeType === 'admin' || routeType === 'auth'
      ? crypto.randomUUID()
      : undefined;

  return applySecurityHeaders(response, pathname, userAgent, routeType, nonce);
}

function applySecurityHeaders(
  response: NextResponse,
  pathname: string,
  userAgent: string,
  routeType: 'admin' | 'auth' | 'storefront' | 'api',
  nonce?: string
): NextResponse {
  // Apply Content Security Policy
  const csp = generateCSP(routeType, nonce);
  response.headers.set('Content-Security-Policy', csp);

  // Set nonce in request header for server components (admin/auth routes only)
  if (nonce) {
    response.headers.set('x-nonce', nonce);
  }

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
     * - api/auth (auth endpoints - handled by Supabase)
     * - api/webhook (webhook endpoints - need raw body)
     * - api/payments/webhook (payment webhooks - need raw body)
     * - manifest.webmanifest (PWA manifest)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/image|_next/static|favicon.ico|api/auth|api/webhook|api/payments/webhook|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js|json)$).*)',
  ],
};
