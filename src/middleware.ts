import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Get the pathname and user agent
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Detect bots/crawlers for optimized SEO caching
  const isBot = /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i.test(userAgent);

  // Add cache headers for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)
  ) {
    // Cache static assets for 1 year
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
        ? 's-maxage=7200, stale-while-revalidate=172800' // 2 hours / 2 days for bots
        : 's-maxage=3600, stale-while-revalidate=86400'  // 1 hour / 1 day for users
    );
    return response;
  }

  // Cache public product pages - significantly longer for bots (better SEO)
  if (pathname.match(/^\/[^/]+\/products\/[^/]+$/)) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=3600, stale-while-revalidate=86400'  // 1 hour / 1 day for bots
        : 's-maxage=300, stale-while-revalidate=3600'    // 5 min / 1 hour for users
    );
    return response;
  }

  // Cache category/collection pages - longer for bots
  if (
    pathname.match(/^\/[^/]+\/category\//) ||
    pathname.match(/^\/[^/]+\/collection\//)
  ) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=1800, stale-while-revalidate=7200'  // 30 min / 2 hours for bots
        : 's-maxage=300, stale-while-revalidate=3600'   // 5 min / 1 hour for users
    );
    return response;
  }

  // Cache storefront home pages - longer for bots
  if (pathname.match(/^\/[^/]+\/?$/) && !pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      isBot
        ? 's-maxage=600, stale-while-revalidate=3600'   // 10 min / 1 hour for bots
        : 's-maxage=60, stale-while-revalidate=300'     // 1 min / 5 min for users
    );
    return response;
  }

  // No cache for authenticated routes (dashboard, API)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
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
     */
    '/((?!_next/image|_next/static|favicon.ico|api/auth|api/webhook|api/payments/webhook|manifest.webmanifest|robots.txt|sitemap.xml).*)',
  ],
};
