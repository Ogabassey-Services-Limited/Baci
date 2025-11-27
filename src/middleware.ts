import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Root domain - merchants get subdomains like ogabassey.usebaci.com
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

// Reserved subdomains that should not be treated as merchant stores
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'dashboard', 'mail', 'smtp'];

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
 * Safely check if hostname is a subdomain of our root domain
 * This prevents attacks like "evilusebaci.com" matching "usebaci.com"
 */
function isSubdomainOfRoot(hostname: string, rootDomain: string): boolean {
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0];
  const expectedSuffix = `.${rootDomain}`;

  // Must end with .rootdomain exactly
  if (!hostWithoutPort.endsWith(expectedSuffix)) {
    return false;
  }

  // Extract subdomain part and validate it's not empty and doesn't contain dots
  // (to prevent ..usebaci.com or nested subdomains being mishandled)
  const subdomain = hostWithoutPort.slice(0, -expectedSuffix.length);
  return subdomain.length > 0 && !subdomain.includes('.');
}

/**
 * Check if hostname exactly matches our root domain or is a known platform domain
 */
function isRootOrPlatformDomain(hostname: string, rootDomain: string): boolean {
  const hostWithoutPort = hostname.split(':')[0];

  // Exact match with root domain
  if (hostWithoutPort === rootDomain) return true;
  if (hostWithoutPort === `www.${rootDomain}`) return true;

  // Vercel preview deployments (exact suffix match)
  if (hostWithoutPort.endsWith('.vercel.app')) return true;

  return false;
}

/**
 * Check if this is localhost/development environment
 */
function isLocalhostRequest(hostname: string): boolean {
  const hostWithoutPort = hostname.split(':')[0];
  return hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1';
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Extract subdomain with proper validation
  let subdomain: string | null = null;

  if (isLocalhostRequest(hostname)) {
    // In development, use path-based routing: localhost:3000/ogabassey/...
    // The (storefront)/[slug] routes handle this
    subdomain = null;
  } else if (isSubdomainOfRoot(hostname, ROOT_DOMAIN)) {
    // Production subdomain: ogabassey.usebaci.com
    // Extract subdomain safely (already validated by isSubdomainOfRoot)
    const hostWithoutPort = hostname.split(':')[0];
    subdomain = hostWithoutPort.slice(0, -(`.${ROOT_DOMAIN}`.length));
  } else if (!isRootOrPlatformDomain(hostname, ROOT_DOMAIN)) {
    // Custom domain: ogabassey.com - need to look up merchant by domain
    // For now, we'll handle this via a header and let the page resolve it
    const response = NextResponse.next();
    response.headers.set('x-custom-domain', hostname);
    return applySecurityHeaders(response, pathname, userAgent);
  }

  // If we have a valid subdomain (not reserved), rewrite to storefront routes
  if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
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
