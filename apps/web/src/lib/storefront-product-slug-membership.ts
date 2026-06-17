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

/**
 * Resolve the trusted base URL for the internal membership hop, or `null` when
 * there is no trusted target. The route resolves the merchant from the
 * `identifier` PATH param (not the Host header), so the call is host-agnostic —
 * we prefer the platform deployment host (`VERCEL_URL`).
 *
 * SECURITY: the caller sends `Authorization: Bearer ${INTERNAL_API_SECRET}`, and
 * `origin` is derived from the (spoofable) request Host. We therefore send the
 * secret ONLY to the platform host, or to a loopback origin in local dev — never
 * to a request-derived custom domain. Any other origin returns `null`, so the
 * caller fails open without ever leaking the secret off-platform.
 */
function resolveInternalBaseUrl(origin: string): string | null {
  const platformHost = process.env.VERCEL_URL;
  if (platformHost) {
    return `https://${platformHost}`;
  }
  return isLoopbackOrigin(origin) ? origin : null;
}

function hasSafeInternalRedirectShape(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !path.includes(':')
  );
}

function isSafeInternalRedirectPath(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const path = value.trim();
  if (!hasSafeInternalRedirectShape(path)) {
    return false;
  }

  try {
    return hasSafeInternalRedirectShape(decodeURIComponent(path));
  } catch {
    return false;
  }
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

    if (
      body.present === true &&
      isSafeInternalRedirectPath(body.redirectPath)
    ) {
      return { kind: 'redirect', redirectPath: body.redirectPath.trim() };
    }

    // Hard-404 ONLY on an explicit, error-free "absent" verdict. Any other
    // shape (present true/undefined, malformed) falls through.
    if (body.present === false) {
      return { kind: 'missing' };
    }

    return { kind: 'present-or-unknown' };
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
