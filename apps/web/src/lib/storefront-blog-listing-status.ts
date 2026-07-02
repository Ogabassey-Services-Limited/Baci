import { z } from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import type { BlogListingStatusIntent } from './cached-storefront-blog-listing-status';
import { fetchInternalStatusJson } from './internal-status-preflight';
import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

const PREFLIGHT_CHECK = 'blog-listing-status';

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
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.intent.kind,
      reason: 'no-secret',
    });
    return { kind: 'noop' };
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.intent.kind,
      reason: 'no-base-url',
    });
    return { kind: 'noop' };
  }

  const url = new URL(
    `/api/internal/blog-listing-status/${encodeURIComponent(opts.identifier)}`,
    baseUrl
  );
  for (const [key, value] of buildIntentQuery(opts.intent)) {
    url.searchParams.set(key, value);
  }

  const result = await fetchInternalStatusJson({
    url,
    secret: opts.secret,
    timeoutMs: opts.timeoutMs ?? 800,
    fetchImpl: opts.fetchImpl,
    context: {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.intent.kind,
    },
  });

  if (result.kind === 'fail-open') {
    return { kind: 'noop' };
  }

  const bodyResult = blogListingStatusResponseSchema.safeParse(result.body);
  if (!bodyResult.success) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.intent.kind,
      reason: 'schema',
    });
    return { kind: 'noop' };
  }
  const body = bodyResult.data;

  if (body.hasError !== false) {
    return { kind: 'noop' };
  }

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
}
