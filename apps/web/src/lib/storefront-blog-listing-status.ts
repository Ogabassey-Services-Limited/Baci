import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import type { BlogListingStatusIntent } from './cached-storefront-blog-listing-status';
import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

const blogListingStatusResponseSchema = z.object({
  hasError: z.boolean(),
  redirectPath: z.string().nullable().optional(),
  permanent: z.boolean().optional(),
  notFound: z.boolean().optional(),
});

interface BlogListingStatusOptions {
  /** Public request origin, used only as a trusted-base fallback in local dev. */
  origin: string;
  /** Storefront slug or custom domain resolved by the proxy. */
  identifier: string;
  /** Parsed listing/category/author intent from the pathname + query. */
  intent: BlogListingStatusIntent;
  /** INTERNAL_API_SECRET; when absent the check is a no-op. */
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type StorefrontBlogListingStatusResolution =
  | { kind: 'noop' }
  | { kind: 'notFound' }
  | { kind: 'redirect'; redirectPath: string; status: 307 | 308 };

function buildIntentQuery(intent: BlogListingStatusIntent): URLSearchParams {
  const query = new URLSearchParams({ kind: intent.kind });
  switch (intent.kind) {
    case 'category-query':
      query.set('category', intent.category);
      break;
    case 'listing-page':
      query.set('page', String(intent.page));
      if (intent.category) {
        query.set('category', intent.category);
      }
      break;
    case 'category-page':
      query.set('categorySlug', intent.categorySlug);
      query.set('page', String(intent.page));
      break;
    case 'author':
      query.set('authorSlug', intent.authorSlug);
      query.set('page', String(intent.page));
      break;
    default:
      break;
  }
  return query;
}

export async function resolveStorefrontBlogListingStatus(
  opts: BlogListingStatusOptions
): Promise<StorefrontBlogListingStatusResolution> {
  if (!opts.secret) {
    return { kind: 'noop' };
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    return { kind: 'noop' };
  }

  try {
    const url = new URL(
      `/api/internal/blog-listing-status/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    for (const [key, value] of buildIntentQuery(opts.intent)) {
      url.searchParams.set(key, value);
    }

    const response = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.secret}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 800),
    });

    if (!response.ok) {
      return { kind: 'noop' };
    }

    const bodyResult = blogListingStatusResponseSchema.safeParse(
      await response.json()
    );
    if (!bodyResult.success || bodyResult.data.hasError !== false) {
      return { kind: 'noop' };
    }
    const body = bodyResult.data;

    const redirectPath = toSafeInternalRedirectPath(body.redirectPath);
    if (redirectPath) {
      return {
        kind: 'redirect',
        redirectPath,
        status: body.permanent === true ? 308 : 307,
      };
    }

    if (body.notFound === true) {
      return { kind: 'notFound' };
    }

    return { kind: 'noop' };
  } catch {
    return { kind: 'noop' };
  }
}
