import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRootDomain, getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';

// Global cache for custom domain lookups (persists across warm invocations in Edge)
// Key: hostname, Value: { slug: string, expiresAt: number }
const domainCache = new Map<string, { slug: string; expiresAt: number }>();
const DOMAIN_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // 1. Rate Limiting (API Only)
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = checkRateLimit(request);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.resetTime
      );
    }
  }

  // 2. CSRF Protection (API Only)
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/webhooks/') &&
    !pathname.startsWith('/api/auth/') &&
    pathname !== '/api/platform/events'
  ) {
    const csrfResult = await checkCsrfProtection(request);

    if (!csrfResult.valid && csrfResult.response) {
      return csrfResult.response;
    }
  }

  const { hostname } = url;
  const rootDomain = getRootDomain();

  // Create a response object to update cookies
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 3. Supabase Auth Optimization
  // Only initialize and check auth if strict security is needed.
  // For public storefronts (subdomains/custom domains) viewing public pages, we skip the expensive getUser() call.

  const isMainSite =
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === rootDomain ||
    hostname === `www.${rootDomain}`;

  // Determine if this is a protected route that requires fresh auth
  // We exclude webhooks and public events from this check to avoid unnecessary auth calls
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/webhooks/') &&
      !pathname.startsWith('/api/platform/events'));

  // Determine if we should skip auth check for performance (Public Storefronts)
  // We only skip if it's NOT the main site (so it's a storefront) AND NOT a protected route.
  // Exception: If we have an auth cookie, we might want to refresh, but for pure speed on storefronts, we often skip.
  // However, to be safe, we'll only enforce getUser() on known protected paths.

  const shouldCheckAuth = isMainSite || isProtectedRoute;

  // Create Supabase client
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        });
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  if (shouldCheckAuth) {
    // Refresh the auth session to ensure cookies are up to date
    // Using getUser() for stronger security (validates JWT with Supabase Auth server)
    await supabase.auth.getUser();
  }

  // 4. Domain Rewriting

  if (isMainSite) {
    return response;
  }

  // Check if it's a custom domain (not a subdomain of rootDomain)
  const isCustomDomain =
    !hostname.endsWith(`.${rootDomain}`) && !hostname.includes('localhost');

  if (isCustomDomain) {
    let merchantSlug: string | undefined;

    // Check Cache first
    const now = Date.now();
    const cached = domainCache.get(hostname);
    if (cached && now < cached.expiresAt) {
      merchantSlug = cached.slug;
    } else {
      // Look up custom domain in database
      const { data: domainRecord } = await supabase
        .from('domains')
        .select('merchant_id, status, merchants!inner(slug)')
        .eq('domain', hostname)
        .eq('status', 'active')
        .single();

      if (domainRecord) {
        // @ts-expect-error - Supabase typing issue with nested select
        merchantSlug = domainRecord.merchants?.slug;

        // Cache the result
        if (merchantSlug) {
          domainCache.set(hostname, {
            slug: merchantSlug,
            expiresAt: now + DOMAIN_CACHE_TTL_MS,
          });
        }
      }
    }

    if (merchantSlug) {
      url.pathname = `/storefront/${merchantSlug}${url.pathname}`;
      return NextResponse.rewrite(url, {
        request: {
          headers: request.headers,
        },
        headers: response.headers,
      });
    }

    // Custom domain not found or not active - redirect to main site
    return NextResponse.redirect(new URL('/', `https://${rootDomain}`));
  }

  // It's a subdomain storefront request. Extract the slug and rewrite.
  const slug = hostname.replace(`.${rootDomain}`, '');

  if (slug && slug !== 'www') {
    url.pathname = `/storefront/${slug}${url.pathname}`;
    return NextResponse.rewrite(url, {
      request: {
        headers: request.headers,
      },
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
