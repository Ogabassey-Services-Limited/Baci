import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { fetchInternalStatusJson } from './internal-status-preflight';
import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

const PREFLIGHT_CHECK = 'blog-post-status';

const blogPostStatusResponseSchema = z.object({
  hasError: z.boolean(),
  present: z.boolean(),
  redirectPath: z.string().nullable().optional(),
});

interface BlogPostStatusOptions {
  /** Public request origin, used only as a trusted-base fallback in local dev. */
  origin: string;
  /** Storefront slug or custom domain resolved by the proxy. */
  identifier: string;
  /** Blog post slug from `/blog/{postSlug}`. */
  postSlug: string;
  /** INTERNAL_API_SECRET; when absent the check fails open. */
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type StorefrontBlogPostStatusResolution =
  | { kind: 'missing' }
  | { kind: 'present-or-unknown' }
  | { kind: 'redirect'; redirectPath: string };

export async function resolveStorefrontBlogPostStatus(
  opts: BlogPostStatusOptions
): Promise<StorefrontBlogPostStatusResolution> {
  if (!opts.secret) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.postSlug,
      reason: 'no-secret',
    });
    return { kind: 'present-or-unknown' };
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.postSlug,
      reason: 'no-base-url',
    });
    return { kind: 'present-or-unknown' };
  }

  const url = new URL(
    `/api/internal/blog-post-status/${encodeURIComponent(opts.identifier)}`,
    baseUrl
  );
  url.searchParams.set('slug', opts.postSlug);

  const result = await fetchInternalStatusJson({
    url,
    secret: opts.secret,
    timeoutMs: opts.timeoutMs ?? 800,
    fetchImpl: opts.fetchImpl,
    context: {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.postSlug,
    },
  });

  if (result.kind === 'fail-open') {
    return { kind: 'present-or-unknown' };
  }

  const bodyResult = blogPostStatusResponseSchema.safeParse(result.body);
  if (!bodyResult.success) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.postSlug,
      reason: 'schema',
    });
    return { kind: 'present-or-unknown' };
  }
  const body = bodyResult.data;

  if (body.hasError !== false) {
    return { kind: 'present-or-unknown' };
  }

  const redirectPath = toSafeInternalRedirectPath(body.redirectPath);
  if (redirectPath) {
    return { kind: 'redirect', redirectPath };
  }

  if (body.present === false) {
    return { kind: 'missing' };
  }

  return { kind: 'present-or-unknown' };
}
