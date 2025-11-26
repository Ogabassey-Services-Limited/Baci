import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Get the pathname
  const pathname = request.nextUrl.pathname;

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

  // Cache product feed APIs at the edge for 1 hour
  if (
    pathname.startsWith('/api/feed/google-merchant') ||
    pathname.startsWith('/api/feed/facebook') ||
    pathname.startsWith('/api/feed/tiktok')
  ) {
    response.headers.set(
      'Cache-Control',
      's-maxage=3600, stale-while-revalidate=86400'
    );
    return response;
  }

  // Cache public product pages for 5 minutes, revalidate in background
  if (pathname.match(/^\/[^/]+\/products\/[^/]+$/)) {
    response.headers.set(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache category/collection pages for 5 minutes
  if (
    pathname.match(/^\/[^/]+\/category\//) ||
    pathname.match(/^\/[^/]+\/collection\//)
  ) {
    response.headers.set(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=3600'
    );
    return response;
  }

  // Cache storefront home pages for 1 minute
  if (pathname.match(/^\/[^/]+\/?$/) && !pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    response.headers.set(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
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
     */
    '/((?!_next/image|favicon.ico).*)',
  ],
};
