import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Import modularized logic
import {
  ROOT_DOMAIN,
  RESERVED_SUBDOMAINS,
  isLocalhost,
  isRootDomain,
  isVercelPreview,
  isValidCustomDomain,
  extractSubdomain,
  extractLocalhostSubdomain,
} from '@/lib/proxy/hostname';
import { getRouteType } from '@/lib/proxy/routes';
import { applySecurityHeaders } from '@/lib/proxy/csp';

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
 * Next.js Middleware Function (Proxy)
 * Handles multi-tenant routing, security headers, caching, and authentication
 */
export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  // console.log('[Proxy] Request:', pathname);
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
    // pathname === '/onboarding' || // Onboarding is protected
    pathname === '/reset-password';

  // Only run auth check for protected or auth routes (skip for public routes, but enable for API headers below)
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

      // FIX: Only allow relative paths to prevent open redirect
      const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
        ? redirectTo
        : '/dashboard';

      const url = request.nextUrl.clone();
      url.pathname = safeRedirect;
      url.search = '';
      return NextResponse.redirect(url);
    }

    // For protected routes, apply security headers
    if (isProtectedRoute) {
      const routeType = getRouteType(pathname); // Should be 'admin' or 'auth' here typically

      if (routeType === 'admin' || routeType === 'auth') {
        return applySecurityHeaders(
          supabaseResponse,
          pathname,
          userAgent,
          routeType,
          crypto.randomUUID()
        );
      }
      // Fallback for edge cases (e.g. api route considered protected?)
      if (routeType === 'api') {
        return applySecurityHeaders(
          supabaseResponse,
          pathname,
          userAgent,
          'api',
          undefined,
          request
        );
      }
      return applySecurityHeaders(
        supabaseResponse,
        pathname,
        userAgent,
        'storefront',
        undefined,
        request
      );
    }
  }

  // Extract subdomain with proper validation
  let subdomain: string | null = null;

  if (isLocalhost(hostname)) {
    // In development, support BOTH:
    // 1. ogabassey.localhost:3000 (subdomain-based, preferred)
    // 2. localhost:3000/ogabassey (path-based, fallback)
    const localSubdomain = extractLocalhostSubdomain(hostname);
    if (localSubdomain) {
      subdomain = localSubdomain;
    } else {
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
      // Root domain or Vercel preview - no subdomain
      subdomain = null;
    } else if (isValidCustomDomain(hostname)) {
      // Custom domain: ogabassey.com
      const domain = hostname.split(':')[0].toLowerCase(); // Basic normalize for now, hostname utility is strictly for root domain logic

      // Prevent redirect loop
      const isAlreadyRewritten = pathname.startsWith(`/${domain}`);

      if (isAlreadyRewritten) {
        // Already rewritten, just pass through with headers set
        const response = NextResponse.next();
        response.headers.set('x-custom-domain', domain);
        response.headers.set('x-merchant-domain', domain);

        // Extract original path by removing the domain prefix
        // const originalPath = pathname.slice(`/${domain}`.length) || '/';
        const routeType = getRouteType(pathname); // Using pathname as is for now for simplicity

        if (routeType === 'admin' || routeType === 'auth') {
          return applySecurityHeaders(response, pathname, userAgent, routeType, crypto.randomUUID());
        } else if (routeType === 'storefront') {
          return applySecurityHeaders(response, pathname, userAgent, routeType, undefined, request);
        }
        return applySecurityHeaders(response, pathname, userAgent, 'api');
      }

      // First visit: Rewrite to /${domain}${pathname}
      const url = request.nextUrl.clone();
      url.pathname = `/${domain}${pathname}`;

      const response = NextResponse.rewrite(url);
      response.headers.set('x-custom-domain', domain);
      response.headers.set('x-merchant-domain', domain);

      // Generate route-specific CSP
      const routeType = getRouteType(pathname);

      if (routeType === 'admin' || routeType === 'auth') {
        return applySecurityHeaders(response, pathname, userAgent, routeType, crypto.randomUUID());
      } else if (routeType === 'storefront') {
        return applySecurityHeaders(response, pathname, userAgent, routeType, undefined, request);
      }
      return applySecurityHeaders(response, pathname, userAgent, 'api');
    } else {
      // Invalid/suspicious hostname - reject
      return new NextResponse('Bad Request', { status: 400 });
    }
  }

  // If we have a valid subdomain (not reserved), rewrite to storefront routes
  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    // Check if trying to access main app routes from subdomain - redirect to main domain
    if (MAIN_APP_ROUTES.some((route) => pathname.startsWith(route))) {
      // FIX: Use protocol aware redirect for Dev/Prod
      const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
      return NextResponse.redirect(new URL(pathname, `${protocol}://${ROOT_DOMAIN}`));
    }

    // Rewrite subdomain requests to path-based storefront routes
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;

    const response = NextResponse.rewrite(url);
    response.headers.set('x-merchant-slug', subdomain);

    const routeType = getRouteType(pathname);

    if (routeType === 'admin' || routeType === 'auth') {
      return applySecurityHeaders(response, pathname, userAgent, routeType, crypto.randomUUID());
    } else if (routeType === 'storefront') {
      return applySecurityHeaders(response, pathname, userAgent, routeType, undefined, request);
    }
    return applySecurityHeaders(response, pathname, userAgent, 'api');
  }

  // Standard request - generate route-specific CSP
  const response = NextResponse.next();
  const routeType = getRouteType(pathname);

  if (routeType === 'admin' || routeType === 'auth') {
    return applySecurityHeaders(response, pathname, userAgent, routeType, crypto.randomUUID());
  } else if (routeType === 'storefront') {
    return applySecurityHeaders(response, pathname, userAgent, routeType, undefined, request);
  }
  return applySecurityHeaders(response, pathname, userAgent, 'api');
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (PWA manifest)
     * - robots.txt (SEO file)
     * - sitemap.xml (SEO file)
     * - Static files with extensions (.svg, .png, .jpg, etc.)
     * 
     * NOTE: We INCLUDE /api/ to ensure security headers are applied, 
     * but the auth middleware skip logic handles them appropriately.
     */
    '/((?!_next/image|_next/static|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js|json)$).*)',
  ],
};
