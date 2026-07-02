import z from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { fetchInternalStatusJson } from './internal-status-preflight';

const PREFLIGHT_CHECK = 'pdp-slug-membership';

const slugSetResponseSchema = z.object({
  hasError: z.boolean(),
  present: z.boolean().optional(),
  redirectPath: z.unknown().optional(),
});

interface SlugMissingOptions {
  /**
   * Public request origin, e.g. `https://ogabassey.com` — used only as a
   * loopback fallback base in local dev. In production the internal call routes
   * through the public platform origin (see `getConfiguredTrustedInternalBaseUrl`),
   * never a request-derived custom domain.
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
  // In Vercel PRODUCTION the auto-generated `VERCEL_URL` deployment host sits
  // behind Deployment Protection (SSO): an internal fetch there 302s to
  // `vercel.com/sso-api` and lands on `vercel.com/login` (HTTP 200 text/html),
  // so `response.json()` throws and the preflight fails open 100% of the time
  // (verified live 2026-07-01). We therefore NEVER use `VERCEL_URL` in
  // production — the internal hop is pinned to the public platform origin
  // (`NEXT_PUBLIC_ROOT_DOMAIN`, default `usebaci.com`), which is not SSO-walled.
  if (process.env.VERCEL_ENV === 'production') {
    return normalizeTrustedInternalBaseUrl(
      process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
    );
  }

  // Preview/local: the deployment URL is directly reachable, so prefer it, then
  // the project production URL. (The former `NEXT_PUBLIC_SITE_URL` tier was
  // removed — it is not in turbo.json's build env allowlist, so Next inlines it
  // as `undefined` at build time, making it a dead, misleading fallback.)
  return (
    normalizeTrustedInternalBaseUrl(process.env.VERCEL_URL) ||
    normalizeTrustedInternalBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  );
}

/**
 * Resolve the trusted base URL for the internal membership hop, or `null` when
 * there is no trusted target. The route resolves the merchant from the
 * `identifier` PATH param (not the Host header), so the call is host-agnostic —
 * we prefer the public platform origin in production and the reachable platform
 * deployment host in preview/local. Request-derived custom domains are never
 * trusted for bearer-token internal calls.
 *
 * SECURITY: the caller sends `Authorization: Bearer ${INTERNAL_API_SECRET}`, and
 * `origin` is derived from the (spoofable) request Host. We therefore send the
 * secret ONLY to platform-configured origins, or to a loopback origin in local
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
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
      reason: 'no-secret',
    });
    return { kind: 'present-or-unknown' };
  }

  // No trusted base → fail open WITHOUT sending the secret to an untrusted host.
  const baseUrl = resolveInternalBaseUrl(opts.origin);
  if (!baseUrl) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
      reason: 'no-base-url',
    });
    return { kind: 'present-or-unknown' };
  }

  const url = new URL(
    `/api/internal/slug-set/${encodeURIComponent(opts.identifier)}`,
    baseUrl
  );
  url.searchParams.set('slug', opts.productSlug);

  const result = await fetchInternalStatusJson({
    url,
    secret: opts.secret,
    timeoutMs: opts.timeoutMs ?? 800,
    fetchImpl: opts.fetchImpl,
    context: {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
    },
  });

  if (result.kind === 'fail-open') {
    return { kind: 'present-or-unknown' };
  }

  const bodyResult = slugSetResponseSchema.safeParse(result.body);
  if (!bodyResult.success) {
    console.warn('[internal-status-preflight] fail-open', {
      check: PREFLIGHT_CHECK,
      identifier: opts.identifier,
      slug: opts.productSlug,
      reason: 'schema',
    });
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
