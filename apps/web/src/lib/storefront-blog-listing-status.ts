import { z } from 'zod';
import { INTERNAL_AUTH_HEADER } from '@/lib/internal-auth-header';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { createAbortSignalTimeout } from './abort-signal-timeout';
import type { BlogListingStatusIntent } from './cached-storefront-blog-listing-status';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

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

function getIntentLogSlug(intent: BlogListingStatusIntent): string {
  switch (intent.kind) {
    case 'category-query':
      return intent.category;
    case 'listing-page':
      return intent.category
        ? `${intent.category}:page-${intent.page}`
        : `page-${intent.page}`;
    case 'category-page':
      return `${intent.categorySlug}:page-${intent.page}`;
    case 'author':
      return `${intent.authorSlug}:page-${intent.page}`;
  }
}

/**
 * The free-text, user-controlled segment of an intent — the value that carries
 * bot-supplied percent-encoding. `page` is a bounded integer, so page-only
 * listing intents have no unsafe segment (returns null → always safe).
 */
function getIntentUserSlug(intent: BlogListingStatusIntent): string | null {
  switch (intent.kind) {
    case 'category-query':
      return intent.category;
    case 'listing-page':
      return intent.category ?? null;
    case 'category-page':
      return intent.categorySlug;
    case 'author':
      return intent.authorSlug;
  }
}

export async function resolveStorefrontBlogListingStatus(
  opts: BlogListingStatusOptions
): Promise<StorefrontBlogListingStatusResolution> {
  const failOpenContext = {
    surface: 'blog-listing-status' as const,
    identifier: opts.identifier,
    slug: getIntentLogSlug(opts.intent),
  };

  // Unsafe (over-long / repeatedly-encoded) category/author segments can never
  // match a listing; skip the internal hop and let the App Router resolve it.
  const userSlug = getIntentUserSlug(opts.intent);
  if (userSlug !== null) {
    const slugSafety = evaluateStorefrontSlugSafety(userSlug);
    if (!slugSafety.safe) {
      storefrontInternalPreflight.warnSkip({
        ...failOpenContext,
        reason: slugSafety.reason,
      });
      return { kind: 'noop' };
    }
  }

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'noop' };
  }

  const baseUrl = storefrontInternalPreflight.resolveBaseUrl(opts.origin);
  if (!baseUrl) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
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

    const timeout = createAbortSignalTimeout(opts.timeoutMs ?? 800);
    try {
      const response = await (opts.fetchImpl ?? fetch)(url, {
        // Authenticate via the custom header, NOT Authorization: Vercel's CDN
        // never caches a response to a request carrying an Authorization header,
        // so this keeps the internal verdict edge-cacheable. Sending both would
        // re-trigger the bypass.
        headers: { [INTERNAL_AUTH_HEADER]: opts.secret },
        redirect: 'manual',
        signal: timeout.signal,
      });
      const json = await storefrontInternalPreflight.readJsonResponse(
        response,
        failOpenContext
      );
      if (json === null) {
        return { kind: 'noop' };
      }

      const bodyResult = blogListingStatusResponseSchema.safeParse(json);
      if (!bodyResult.success || bodyResult.data.hasError !== false) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: bodyResult.success ? 'has-error' : 'parse',
        });
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

      if (body.redirectPath != null) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'unsafe-redirect',
        });
        return { kind: 'noop' };
      }

      if (body.notFound === true) {
        return { kind: 'notFound' };
      }

      return { kind: 'noop' };
    } finally {
      timeout.clear();
    }
  } catch (error) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: storefrontInternalPreflight.getFetchErrorReason(error),
    });
    return { kind: 'noop' };
  }
}
