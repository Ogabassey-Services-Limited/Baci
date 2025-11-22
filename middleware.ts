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

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.tech';

  // Check if the request is for the main marketing site or a dev environment
  const isMainSite =
    hostname === 'localhost' || // local dev
    hostname === '0.0.0.0' ||
    hostname === rootDomain ||
    hostname === `www.${rootDomain}`;

  if (isMainSite) {
    return response;
  }

  // Check if it's a custom domain (not a subdomain of rootDomain)
  const isCustomDomain = !hostname.endsWith(`.${rootDomain}`) && !hostname.includes('localhost');

  if (isCustomDomain) {
    // Look up custom domain in database
    const { data: domainRecord } = await supabase
      .from('domains')
      .select('merchant_id, status, merchants!inner(slug)')
      .eq('domain', hostname)
      .eq('status', 'active')
      .single();

    if (domainRecord) {
      // @ts-ignore - Supabase typing issue with nested select
      const merchantSlug = domainRecord.merchants?.slug;
      if (merchantSlug) {
        url.pathname = `/storefront/${merchantSlug}${url.pathname}`;
        return NextResponse.rewrite(url, {
          request: {
            headers: request.headers,
          },
          headers: response.headers,
        });
      }
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
