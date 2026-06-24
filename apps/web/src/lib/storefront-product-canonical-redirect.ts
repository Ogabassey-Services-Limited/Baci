import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

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

function isSafeRedirectPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/[\r\n]/.test(value)
  );
}

export async function getStorefrontProductCanonicalRedirectPath(
  opts: ProductCanonicalRedirectOptions
): Promise<string | null> {
  if (!opts.secret) {
    return null;
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(
      `/api/internal/product-canonical/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    url.searchParams.set('category', opts.category);
    url.searchParams.set('slug', opts.productSlug);

    const response = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.secret}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 800),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      hasError?: boolean;
      redirectPath?: unknown;
    };

    if (body?.hasError === false && isSafeRedirectPath(body.redirectPath)) {
      return body.redirectPath;
    }

    return null;
  } catch {
    return null;
  }
}
