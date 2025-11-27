/**
 * Cache header utilities for API routes
 * Implements edge caching strategies for Vercel
 */

export type CacheStrategy =
  | 'no-cache'           // Don't cache (auth, dashboard)
  | 'short'              // 1 minute cache (dynamic data)
  | 'medium'             // 5 minutes cache (frequently updated)
  | 'long'               // 1 hour cache (rarely updated)
  | 'static'             // 1 day cache (static content)
  | 'immutable';         // 1 year cache (versioned assets)

/**
 * Map a CacheStrategy to its corresponding `Cache-Control` header value.
 *
 * @param strategy - Cache strategy identifier: 'no-cache', 'short', 'medium', 'long', 'static', or 'immutable'
 * @returns The `Cache-Control` header value that implements the chosen strategy
 */
export function getCacheControl(strategy: CacheStrategy): string {
  switch (strategy) {
    case 'no-cache':
      return 'no-store, no-cache, must-revalidate, max-age=0';

    case 'short':
      // Cache for 1 minute, serve stale for 5 minutes while revalidating
      return 'public, s-maxage=60, stale-while-revalidate=300';

    case 'medium':
      // Cache for 5 minutes, serve stale for 1 hour while revalidating
      return 'public, s-maxage=300, stale-while-revalidate=3600';

    case 'long':
      // Cache for 1 hour, serve stale for 1 day while revalidating
      return 'public, s-maxage=3600, stale-while-revalidate=86400';

    case 'static':
      // Cache for 1 day, serve stale for 1 week while revalidating
      return 'public, s-maxage=86400, stale-while-revalidate=604800';

    case 'immutable':
      // Cache for 1 year, never changes
      return 'public, max-age=31536000, immutable';

    default:
      return 'no-cache';
  }
}

/**
 * Cache control headers for common scenarios
 */
export const CACHE_HEADERS = {
  // No caching for sensitive/dynamic data
  NO_CACHE: {
    'Cache-Control': getCacheControl('no-cache'),
  },

  // Short cache for frequently changing data
  SHORT: {
    'Cache-Control': getCacheControl('short'),
  },

  // Medium cache for semi-dynamic data
  MEDIUM: {
    'Cache-Control': getCacheControl('medium'),
  },

  // Long cache for rarely changing data
  LONG: {
    'Cache-Control': getCacheControl('long'),
  },

  // Static content cache
  STATIC: {
    'Cache-Control': getCacheControl('static'),
  },

  // Immutable assets
  IMMUTABLE: {
    'Cache-Control': getCacheControl('immutable'),
  },
} as const;

/**
 * Return a new Response identical to the given one but with a Cache-Control header applied.
 *
 * @param response - The original Response whose body, status, and statusText will be preserved
 * @param strategy - Cache strategy determining the `Cache-Control` header value; defaults to `'medium'`
 * @returns A new Response with the same body, status, and statusText and a `Cache-Control` header set according to `strategy`
 */
export function withCacheHeaders(
  response: Response,
  strategy: CacheStrategy = 'medium'
): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cache-Control', getCacheControl(strategy));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}