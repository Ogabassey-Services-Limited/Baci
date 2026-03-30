import { NextResponse } from 'next/server';

/**
 * RFC 8615 reserves /.well-known/* for infrastructure metadata.
 * Unsupported entries should terminate here instead of falling through
 * to storefront dynamic routes and triggering merchant lookups.
 */
export function GET(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
