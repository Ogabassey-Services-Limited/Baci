import type { resolveStorefrontComparePageStatus } from './storefront-compare-page-status';

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function buildOptions(
  fetchImpl: typeof fetch,
  overrides: Partial<
    Parameters<typeof resolveStorefrontComparePageStatus>[0]
  > = {}
) {
  return {
    origin: 'http://localhost:3000',
    identifier: 'ogabassey',
    categorySlug: 'laptops',
    comparisonSlug: 'left-laptop-vs-right-laptop',
    secret: 'test-internal-secret',
    fetchImpl,
    ...overrides,
  };
}
