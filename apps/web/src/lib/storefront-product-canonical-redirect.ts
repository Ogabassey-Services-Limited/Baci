import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { fetchInternalStatusJson } from './internal-status-preflight';
import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

const PREFLIGHT_CHECK = 'pdp-canonical';

interface ProductCanonicalRedirectOptions {
  /** Public request origin, used only as a trusted-base fallback in local dev. */
  origin: string;
  /** Storefront slug or custom domain resolved by the proxy. */
  identifier: string;
  /** First public PDP path segment, usually the category slug. */
  category: string;
  /** Product slug from the public PDP path. */
  productSlug: string;
  /** INTERNAL_API_SECRET; when absent the check fails open. */
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type StorefrontProductCanonicalRedirectResult =
  | { kind: 'redirect'; redirectPath: string }
  | { kind: 'checked-no-redirect' }
  | { kind: 'unknown' };

export async function getStorefrontProductCanonicalRedirectResult(
  opts: ProductCanonicalRedirectOptions
): Promise<StorefrontProductCanonicalRedirectResult> {
  if (!opts.secret) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
      reason: 'no-secret',
    });
    return { kind: 'unknown' };
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
      reason: 'no-base-url',
    });
    return { kind: 'unknown' };
  }

  const url = new URL(
    `/api/internal/product-canonical/${encodeURIComponent(opts.identifier)}`,
    baseUrl
  );
  url.searchParams.set('category', opts.category);
  url.searchParams.set('slug', opts.productSlug);

  const result = await fetchInternalStatusJson({
    url,
    secret: opts.secret,
    timeoutMs: opts.timeoutMs ?? 800,
    fetchImpl: opts.fetchImpl,
    context: {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
    },
  });

  if (result.kind === 'fail-open') {
    return { kind: 'unknown' };
  }

  const body = result.body as {
    hasError?: boolean;
    matchedProduct?: boolean;
    redirectPath?: unknown;
  };

  if (body?.hasError !== false) {
    return { kind: 'unknown' };
  }

  const redirectPath = toSafeInternalRedirectPath(body.redirectPath);
  if (redirectPath) {
    return { kind: 'redirect', redirectPath };
  }

  return body.matchedProduct === true
    ? { kind: 'checked-no-redirect' }
    : { kind: 'unknown' };
}

export async function getStorefrontProductCanonicalRedirectPath(
  opts: ProductCanonicalRedirectOptions
): Promise<string | null> {
  const result = await getStorefrontProductCanonicalRedirectResult(opts);
  return result.kind === 'redirect' ? result.redirectPath : null;
}
