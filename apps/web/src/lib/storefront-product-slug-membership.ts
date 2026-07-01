import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { createAbortSignalTimeout } from './abort-signal-timeout';

const slugSetResponseSchema = z.object({
  hasError: z.boolean(),
  present: z.boolean().optional(),
  redirectPath: z.unknown().optional(),
});

interface SlugMissingOptions {
  /**
   * Public request origin, e.g. `https://ogabassey.com` — used as the fallback
   * fetch base only. When the platform host (`VERCEL_URL`) is available the
   * internal call routes through it instead, so a custom domain does not pay an
   * extra DNS/TLS handshake on every PDP navigation.
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

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
}

function normalizeTrustedInternalBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && !isLoopbackOrigin(url.origin)) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredTrustedInternalBaseUrl() {
  return (
    normalizeTrustedInternalBaseUrl(process.env.VERCEL_URL) ||
    normalizeTrustedInternalBaseUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
    ) ||
    normalizeTrustedInternalBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    // Last-resort production fallback: keep preflight calls on the platform
    // root when Vercel's deployment URL envs are unavailable.
    (process.env.NODE_ENV === 'production'
      ? normalizeTrustedInternalBaseUrl(
          process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
        )
      : null)
  );
}

/**
 * Resolve the trusted base URL for the internal membership hop, or `null` when
 * there is no trusted target. The route resolves the merchant from the
 * `identifier` PATH param (not the Host header), so the call is host-agnostic —
 * we prefer the platform deployment host (`VERCEL_URL`) or a configured platform
 * origin. Request-derived custom domains are never trusted for bearer-token
 * internal calls.
 *
 * SECURITY: the caller sends `Authorization: Bearer ${INTERNAL_API_SECRET}`, and
 * `origin` is derived from the (spoofable) request Host. We therefore send the
 * secret ONLY to configured platform hosts, or to a loopback origin in local
 * dev — never to a request-derived custom domain. Any other origin returns
 * `null`, so the caller fails open without leaking the secret off-platform.
 */
export function resolveInternalBaseUrl(origin: string): string | null {
  const configuredBaseUrl = getConfiguredTrustedInternalBaseUrl();
  if (configuredBaseUrl) return configuredBaseUrl;

  return isLoopbackOrigin(origin) ? origin : null;
}

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
  if (!opts.secret) {
    return { kind: 'present-or-unknown' };
  }

  // No trusted base → fail open WITHOUT sending the secret to an untrusted host.
  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
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
        headers: { Authorization: `Bearer ${opts.secret}` },
        signal: timeout.signal,
      });

      if (!response.ok) {
        return { kind: 'present-or-unknown' };
      }

      const bodyResult = slugSetResponseSchema.safeParse(await response.json());
      if (!bodyResult.success) {
        return { kind: 'present-or-unknown' };
      }
      const body = bodyResult.data;

      if (body.hasError !== false) {
        return { kind: 'present-or-unknown' };
      }

      const redirectPath = toSafeInternalRedirectPath(body.redirectPath);
      if (body.present === true && redirectPath) {
        return { kind: 'redirect', redirectPath };
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
  } catch {
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
