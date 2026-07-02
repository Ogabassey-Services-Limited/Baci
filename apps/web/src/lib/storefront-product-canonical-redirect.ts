import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { createAbortSignalTimeout } from './abort-signal-timeout';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

const productCanonicalRedirectResponseSchema = z.object({
  hasError: z.boolean(),
  matchedProduct: z.boolean().optional(),
  redirectPath: z.unknown().optional(),
});

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
  const failOpenContext = {
    surface: 'product-canonical' as const,
    identifier: opts.identifier,
    slug: opts.productSlug,
  };

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'unknown' };
  }

  const baseUrl = storefrontInternalPreflight.resolveBaseUrl(opts.origin);
  if (!baseUrl) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
    return { kind: 'unknown' };
  }

  try {
    const url = new URL(
      `/api/internal/product-canonical/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    url.searchParams.set('category', opts.category);
    url.searchParams.set('slug', opts.productSlug);

    const timeout = createAbortSignalTimeout(opts.timeoutMs ?? 800);
    try {
      const response = await (opts.fetchImpl ?? fetch)(url, {
        headers: { Authorization: `Bearer ${opts.secret}` },
        redirect: 'manual',
        signal: timeout.signal,
      });
      const json = await storefrontInternalPreflight.readJsonResponse(
        response,
        failOpenContext
      );
      if (json === null) {
        return { kind: 'unknown' };
      }

      const bodyResult = productCanonicalRedirectResponseSchema.safeParse(json);
      if (!bodyResult.success) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'parse',
        });
        return { kind: 'unknown' };
      }
      const body = bodyResult.data;

      if (body.hasError !== false) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'has-error',
        });
        return { kind: 'unknown' };
      }

      const redirectPath = toSafeInternalRedirectPath(body.redirectPath);
      if (redirectPath) {
        return { kind: 'redirect', redirectPath };
      }

      if (body.redirectPath != null && !redirectPath) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'unsafe-redirect',
        });
        return { kind: 'unknown' };
      }

      return body.matchedProduct === true
        ? { kind: 'checked-no-redirect' }
        : { kind: 'unknown' };
    } finally {
      timeout.clear();
    }
  } catch (error) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: storefrontInternalPreflight.getFetchErrorReason(error),
    });
    return { kind: 'unknown' };
  }
}

export async function getStorefrontProductCanonicalRedirectPath(
  opts: ProductCanonicalRedirectOptions
): Promise<string | null> {
  const result = await getStorefrontProductCanonicalRedirectResult(opts);
  return result.kind === 'redirect' ? result.redirectPath : null;
}
