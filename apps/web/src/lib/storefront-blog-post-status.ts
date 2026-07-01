import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { resolveInternalBaseUrl } from './storefront-product-slug-membership';

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
    return { kind: 'present-or-unknown' };
  }

  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    return { kind: 'present-or-unknown' };
  }

  try {
    const url = new URL(
      `/api/internal/blog-post-status/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    url.searchParams.set('slug', opts.postSlug);

    const response = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.secret}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 800),
    });

    if (!response.ok) {
      return { kind: 'present-or-unknown' };
    }

    const body = (await response.json()) as {
      hasError?: boolean;
      present?: boolean;
      redirectPath?: unknown;
    };

    if (body?.hasError !== false) {
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
  } catch {
    return { kind: 'present-or-unknown' };
  }
}
