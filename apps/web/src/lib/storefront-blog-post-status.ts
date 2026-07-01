import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { createAbortSignalTimeout } from './abort-signal-timeout';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

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
  const failOpenContext = {
    surface: 'blog-post-status' as const,
    identifier: opts.identifier,
    slug: opts.postSlug,
  };

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'present-or-unknown' };
  }

  const baseUrl = storefrontInternalPreflight.resolveBaseUrl(opts.origin);
  if (!baseUrl) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
    return { kind: 'present-or-unknown' };
  }

  try {
    const url = new URL(
      `/api/internal/blog-post-status/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    url.searchParams.set('slug', opts.postSlug);

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
        return { kind: 'present-or-unknown' };
      }

      const bodyResult = blogPostStatusResponseSchema.safeParse(json);
      if (!bodyResult.success) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'parse',
        });
        return { kind: 'present-or-unknown' };
      }
      const body = bodyResult.data;

      if (body.hasError !== false) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'has-error',
        });
        return { kind: 'present-or-unknown' };
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
        return { kind: 'present-or-unknown' };
      }

      if (body.present === false) {
        return { kind: 'missing' };
      }

      return { kind: 'present-or-unknown' };
    } finally {
      timeout.clear();
    }
  } catch (error) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: storefrontInternalPreflight.getFetchErrorReason(error),
    });
    return { kind: 'present-or-unknown' };
  }
}
