import { constantTimeEqual } from '@/lib/constant-time-equal';

/**
 * Custom header the proxy's internal preflight self-fetches use to carry the
 * `INTERNAL_API_SECRET`.
 *
 * Vercel's CDN never caches a response to a request that carries an
 * `Authorization` header (documented cacheable-response criteria: "Request
 * doesn't contain `Authorization` header"). The cache-eligible internal
 * preflight routes therefore authenticate off THIS header instead, so the CDN
 * can store and replay their verdict. Callers send ONLY this header — adding
 * `Authorization` as well would re-trigger the bypass and defeat the cache.
 */
export const INTERNAL_AUTH_HEADER = 'x-baci-internal-auth';

export type InternalAuthMethod = 'custom-header' | 'authorization';

/**
 * Returns WHICH header authenticated the request — `'custom-header'` for
 * `x-baci-internal-auth` (checked first), `'authorization'` for the legacy
 * `Authorization: Bearer <secret>`, or `null` when neither matches. Both
 * comparisons are timing-safe. `expectedSecret` must be non-empty; callers
 * reject an unconfigured secret before calling.
 *
 * Cache-eligible routes must emit their cacheable headers ONLY for
 * `'custom-header'` requests: RFC 9111 §3.5 allows a shared cache to store a
 * response to an Authorization-bearing request when `s-maxage` is present, so
 * a Bearer-authenticated verdict could otherwise be stored under a cache key
 * where the custom header is ABSENT — the same key an unauthenticated request
 * would hit.
 */
export function getValidatedInternalAuthMethod(
  request: { headers: Headers },
  expectedSecret: string
): InternalAuthMethod | null {
  const customHeader = request.headers.get(INTERNAL_AUTH_HEADER);
  if (customHeader && constantTimeEqual(customHeader, expectedSecret)) {
    return 'custom-header';
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader && constantTimeEqual(authHeader, `Bearer ${expectedSecret}`)) {
    return 'authorization';
  }

  return null;
}

/**
 * True when the request carries the internal secret via EITHER the custom
 * `x-baci-internal-auth` header (preferred — keeps the response CDN-cacheable)
 * OR the legacy `Authorization: Bearer <secret>` header.
 */
export function hasValidInternalAuth(
  request: { headers: Headers },
  expectedSecret: string
): boolean {
  return getValidatedInternalAuthMethod(request, expectedSecret) !== null;
}
