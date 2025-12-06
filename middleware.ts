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
const MAX_CACHE_SIZE = 1000; // Prevent unbounded memory growth

// Prune expired entries when cache gets too large
function pruneDomainCache(now: number): void {
  if (domainCache.size < MAX_CACHE_SIZE) return;
  domainCache.forEach((value, key) => {
    if (now > value.expiresAt) {
      domainCache.delete(key);
    }
  });
}

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
  // Only initialize and check auth for protected routes to reduce latency on public storefronts
  const isMainSite =
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === rootDomain ||
    hostname === `www.${rootDomain}`;

  // Protected routes that require fresh auth validation
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/webhooks/') &&
      !pathname.startsWith('/api/platform/events'));

  // Only check auth for main site or protected routes (skip for public storefronts)
  const shouldCheckAuth = isMainSite || isProtectedRoute;

  // Create Supabase client for middleware to manage auth session
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

  // 4. Domain Routing

  if (isMainSite) {
    return response;
  }

  // Check if it's a custom domain (not a subdomain of rootDomain)
  const isCustomDomain =
    !hostname.endsWith(`.${rootDomain}`) && !hostname.includes('localhost');

  if (isCustomDomain) {
    let merchantSlug: string | undefined;

    // Check cache first (and prune if needed)
    const now = Date.now();
    pruneDomainCache(now);
    const cached = domainCache.get(hostname);
    if (cached && now < cached.expiresAt) {
      merchantSlug = cached.slug;
    } else {
      // Look up custom domain in database
      try {
        const { data: domainRecord, error } = await supabase
          .from('domains')
          .select('merchant_id, status, merchants!inner(slug)')
          .eq('domain', hostname)
          .eq('status', 'active')
          .single();

        if (!error && domainRecord) {
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
      } catch {
        // On database error, fall through to redirect to main site
        // This prevents middleware from crashing on transient DB issues
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
