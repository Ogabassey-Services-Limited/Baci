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
 * Map a cache strategy name to its corresponding `Cache-Control` header value.
 *
 * @param strategy - One of: 'no-cache', 'short', 'medium', 'long', 'static', 'immutable'
 * @returns The `Cache-Control` header string associated with `strategy`
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
 * Clone a Response and apply a Cache-Control header for the given caching strategy.
 *
 * @param response - The original Response to clone
 * @param strategy - Cache strategy to determine the `Cache-Control` header; defaults to `'medium'`
 * @returns A new Response with the same body, status, and statusText as `response`, and its `Cache-Control` header set according to `strategy`
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