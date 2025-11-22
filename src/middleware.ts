
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { checkCsrfProtection } from '@/lib/csrf';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = checkRateLimit(request);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.resetTime
      );
    }

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());
  }

  // Apply CSRF protection to API routes (except webhooks and auth)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/') && !pathname.startsWith('/api/auth/')) {
    const csrfResult = await checkCsrfProtection(request);

    if (!csrfResult.valid && csrfResult.response) {
      return csrfResult.response;
    }
  }
  const { hostname } = url;

  // Create a response object to update cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware to manage auth session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Refresh the auth session to ensure cookies are up to date
  await supabase.auth.getUser();

  // Use a placeholder for the root domain, which you would replace with your actual domain in production.
  // We use a common pattern that should work for localhost and deployed environments.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.tech';
  const isLocal = hostname.includes('localhost');

  // Clean up the hostname to get the main domain part
  const normalizedHost = hostname.replace(`.${rootDomain}`, '').replace(`.${isLocal ? 'localhost:3000' : rootDomain}`, '');

  // If it's a request to the main marketing site, let it pass.
  // Path-based storefronts like /storefront/my-store will also be allowed through by this logic.
  if (hostname === `localhost:3000` || hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return response;
  }

  // It's a subdomain storefront request. Extract the slug and rewrite to the correct path.
  // e.g., "ogabassey.baci.tech" -> "ogabassey"
  const slug = normalizedHost;

  if (slug) {
    console.log(`Rewriting ${hostname} to /storefront/${slug}`);
    url.pathname = `/storefront/${slug}`;
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
