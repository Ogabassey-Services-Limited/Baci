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

/**
 * True when the request carries the internal secret via EITHER the custom
 * `x-baci-internal-auth` header (preferred — keeps the response CDN-cacheable)
 * OR the legacy `Authorization: Bearer <secret>` header. Both comparisons are
 * timing-safe. `expectedSecret` must be non-empty; callers reject an
 * unconfigured secret before calling.
 */
export function hasValidInternalAuth(
  request: { headers: Headers },
  expectedSecret: string
): boolean {
  const customHeader = request.headers.get(INTERNAL_AUTH_HEADER);
  if (customHeader && constantTimeEqual(customHeader, expectedSecret)) {
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  return (
    Boolean(authHeader) &&
    constantTimeEqual(authHeader ?? '', `Bearer ${expectedSecret}`)
  );
}
