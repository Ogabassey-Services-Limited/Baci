import { INTERNAL_AUTH_HEADER } from '@/lib/internal-auth-header';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { internalCompareHubStatusBodySchema } from '@/schemas/internal-slug-set-route';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

const DEFAULT_TIMEOUT_MS = 2_500;

interface CompareHubStatusOptions {
  /** Public request origin the internal self-fetch targets. */
  origin: string;
  /** Storefront slug or custom domain the proxy resolved. */
  identifier: string;
  /** The category slug from the hub path (`/{category}/compare`). */
  categorySlug: string;
  /**
   * `INTERNAL_API_SECRET`; when absent the check fails open. Kept as the
   * operational kill-switch: unsetting the secret disables the preflight
   * without a deploy.
   */
  secret: string | undefined;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Tight budget — a slow verdict must not delay navigations. */
  timeoutMs?: number;
}

export type StorefrontCompareHubStatusResolution =
  | { kind: 'empty' }
  | { kind: 'renderable-or-unknown' };

/**
 * Resolves whether a `/{category}/compare` hub is confirmed empty for the
 * proxy's crawl-budget hard-404 (the page-level thin-hub `notFound()` only
 * yields a PPR soft-404 — 200 + noindex shell — so crawlers never see a true
 * status without this preflight).
 *
 * The verdict comes from the internal `/api/internal/compare-hub-status` route
 * — a deliberate HTTP self-fetch, NOT a direct RPC like the PDP/blog
 * preflights: hub emptiness is decided by the compare-link spec-eligibility
 * logic that lives in TypeScript, and the route runs EXACTLY the code the hub
 * page runs (`resolveCategoryCompareHubStatus`), so proxy and page can never
 * disagree about which hubs exist. Hub navigations are orders of magnitude
 * rarer than PDP navigations, so the self-fetch latency tail the RPC migration
 * eliminated is acceptable here.
 *
 * Fail-open by construction: a missing secret, unsafe category segment,
 * transport error, timeout, non-200 response, malformed body, or a
 * `hasError` (degraded-resolver) body all return `renderable-or-unknown` so
 * the proxy never hard-404s a live hub on stale/unavailable data.
 */
export async function resolveStorefrontCompareHubStatus(
  opts: CompareHubStatusOptions
): Promise<StorefrontCompareHubStatusResolution> {
  const failOpenContext = {
    surface: 'compare-hub-status' as const,
    identifier: opts.identifier,
    slug: opts.categorySlug,
  };

  // Unsafe (over-long / repeatedly-encoded) category segments can never match
  // a real category; skip the doomed lookup and let the App Router decide.
  const slugSafety = evaluateStorefrontSlugSafety(opts.categorySlug);
  if (!slugSafety.safe) {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: slugSafety.reason,
    });
    return { kind: 'renderable-or-unknown' };
  }

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'renderable-or-unknown' };
  }

  // The secret only travels to a TRUSTED origin: loopback in dev, the
  // configured platform root domain otherwise — never the request's own
  // origin. A merchant custom domain's DNS is merchant-controlled, so a
  // self-fetch to the incoming origin could exfiltrate the internal secret to
  // whatever that domain resolves to tomorrow. `redirect: 'manual'` pairs with
  // readJsonResponse's 3xx fail-open so the secret is never replayed to a
  // redirect target either.
  const baseUrl = storefrontInternalPreflight.resolveBaseUrl(opts.origin);
  if (!baseUrl) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
    return { kind: 'renderable-or-unknown' };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${baseUrl}/api/internal/compare-hub-status/${encodeURIComponent(
    opts.identifier
  )}?category=${encodeURIComponent(opts.categorySlug)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { [INTERNAL_AUTH_HEADER]: opts.secret },
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: storefrontInternalPreflight.getFetchErrorReason(error),
    });
    return { kind: 'renderable-or-unknown' };
  }

  const body = await storefrontInternalPreflight.readJsonResponse(
    response,
    failOpenContext
  );
  if (body === null) {
    return { kind: 'renderable-or-unknown' };
  }

  const parsed = internalCompareHubStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'parse',
    });
    return { kind: 'renderable-or-unknown' };
  }

  if (parsed.data.hasError) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'has-error',
    });
    return { kind: 'renderable-or-unknown' };
  }

  return parsed.data.empty
    ? { kind: 'empty' }
    : { kind: 'renderable-or-unknown' };
}
