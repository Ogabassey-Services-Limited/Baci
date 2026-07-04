import z from 'zod';
import { INTERNAL_AUTH_HEADER } from '@/lib/internal-auth-header';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { createAbortSignalTimeout } from './abort-signal-timeout';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

const slugSetResponseSchema = z.object({
  hasError: z.boolean(),
  present: z.boolean().optional(),
  redirectPath: z.unknown().optional(),
});

interface SlugMissingOptions {
  /**
   * Public request origin, e.g. `https://ogabassey.com` — used as the fallback
   * fetch base only. Production calls use the configured public platform root,
   * never Vercel's generated deployment host, because protected generated URLs
   * can SSO-wall middleware self-fetches.
   */
  origin: string;
  /** Storefront slug or custom domain the proxy has (resolved by the route). */
  identifier: string;
  /** The product slug from the PDP path (`/{category}/{productSlug}`). */
  productSlug: string;
  /** `INTERNAL_API_SECRET`; when absent the check fails open. */
  secret: string | undefined;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Tight budget — a slow internal hop must not delay navigations. */
  timeoutMs?: number;
}

export type StorefrontProductSlugResolution =
  | { kind: 'missing' }
  | { kind: 'present-or-unknown' }
  | { kind: 'redirect'; redirectPath: string };

/**
 * Resolves a storefront PDP slug for the proxy: missing slugs become real hard
 * 404s, archived aliases become real 308s, and every uncertain/live case falls
 * through to the App Router.
 *
 * Delegates the membership decision to the internal route (which can legally
 * call the `'use cache'` slug-set builder the proxy cannot) and reads back only
 * `{ hasError, present, redirectPath? }` — never the full slug list — so a
 * large catalog adds no slug-list transfer/parse to the navigation.
 *
 * Fail-open by construction: a missing secret, non-2xx, transport error,
 * timeout, `hasError`, malformed body, or unsafe redirect all return
 * `present-or-unknown` so the proxy never hard-404s or open-redirects a live
 * product on a stale/unavailable set.
 */
export async function resolveStorefrontProductSlugResolution(
  opts: SlugMissingOptions
): Promise<StorefrontProductSlugResolution> {
  const failOpenContext = {
    surface: 'product-slug' as const,
    identifier: opts.identifier,
    slug: opts.productSlug,
  };

  // Unsafe (over-long / repeatedly-encoded) slugs can never be live products,
  // but do NOT hard-404 here: the internal slug-set endpoint deliberately
  // fails open for unpublished/unknown storefronts (so they still render the
  // coming-soon shell instead of a proxy 404). Skip the doomed internal hop and
  // fail open too, letting the App Router decide — a published store renders
  // the render-route not-found gate, an unpublished store its coming-soon shell.
  const slugSafety = evaluateStorefrontSlugSafety(opts.productSlug);
  if (!slugSafety.safe) {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: slugSafety.reason,
    });
    return { kind: 'present-or-unknown' };
  }

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'present-or-unknown' };
  }

  // No trusted base → fail open WITHOUT sending the secret to an untrusted host.
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
      `/api/internal/slug-set/${encodeURIComponent(opts.identifier)}`,
      baseUrl
    );
    url.searchParams.set('slug', opts.productSlug);

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
        return { kind: 'present-or-unknown' };
      }

      const bodyResult = slugSetResponseSchema.safeParse(json);
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
      if (body.present === true && redirectPath) {
        return { kind: 'redirect', redirectPath };
      }

      if (body.redirectPath != null && !redirectPath) {
        storefrontInternalPreflight.warnFailOpen({
          ...failOpenContext,
          reason: 'unsafe-redirect',
        });
        return { kind: 'present-or-unknown' };
      }

      // Hard-404 ONLY on an explicit, error-free "absent" verdict. Any other
      // shape (present true/undefined, malformed) falls through.
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

/**
 * Compatibility wrapper for callers/tests that only need the hard-404 verdict.
 */
export async function isStorefrontProductSlugMissing(
  opts: SlugMissingOptions
): Promise<boolean> {
  const resolution = await resolveStorefrontProductSlugResolution(opts);
  return resolution.kind === 'missing';
}
