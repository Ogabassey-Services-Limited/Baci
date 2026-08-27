import { INTERNAL_AUTH_HEADER } from '@/lib/internal-auth-header';
import { parseCompareSlug } from '@/lib/storefront-compare/compare-slugs';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { internalComparePageStatusBodySchema } from '@/schemas/internal-slug-set-route';
import { storefrontInternalPreflight } from './storefront-internal-preflight';
import { createStorefrontPreflightCircuitBreaker } from './storefront-preflight-circuit-breaker';

const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_COMPARE_STATUS_COMPOSITE_LENGTH = 1_024;
// Compare status is an optional hard-404 optimization. Bound concurrent
// self-fetches so a crawler burst cannot turn the slow internal route into an
// unbounded fan-out; admitted callers still retain the existing fail-open
// timeout and circuit-breaker semantics.
const MAX_COMPARE_PAGE_STATUS_IN_FLIGHT = 8;
const comparePageStatusBreaker = createStorefrontPreflightCircuitBreaker();
const comparePageStatusInFlight = new Map<
  string,
  Promise<StorefrontComparePageStatusResolution>
>();

interface ComparePageStatusOptions {
  /** Public request origin; the transport resolves a trusted platform target. */
  origin: string;
  /** Storefront slug or custom domain resolved by the proxy. */
  identifier: string;
  /** Category segment from `/{category}/compare/{comparison}`. */
  categorySlug: string;
  /** Composite product/brand comparison segment. */
  comparisonSlug: string;
  /** Internal API secret; absent means the preflight is disabled. */
  secret: string | undefined;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Tight upper bound for the internal status read. */
  timeoutMs?: number;
}

export type StorefrontComparePageStatusResolution =
  | { kind: 'missing' }
  | { kind: 'renderable-or-unknown' };

type ComparePageStatusFailOpenContext = {
  surface: 'compare-page-status';
  identifier: string;
  slug: string;
};

function comparePageStatusRequestKey(url: string, secret: string): string {
  // Keep the credential in the in-memory key so a rotated secret cannot share
  // a pending response with the previous credential. The key is never logged.
  return `${url}\u0000${secret}`;
}

function captureBreakerOpenTransition(
  failOpenContext: ComparePageStatusFailOpenContext
): void {
  if (comparePageStatusBreaker.consumeOpenTransition()) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'circuit-open',
    });
  }
}

function recordComparePageStatusFailure(
  failOpenContext: ComparePageStatusFailOpenContext
): void {
  comparePageStatusBreaker.recordFailure();
  captureBreakerOpenTransition(failOpenContext);
}

function isRequestSpecificClientError(response: Response): boolean {
  return response.status >= 400 && response.status < 500;
}

async function resolveStorefrontComparePageStatusUncached(
  opts: ComparePageStatusOptions,
  secret: string,
  url: string,
  fetchImpl: typeof fetch,
  failOpenContext: ComparePageStatusFailOpenContext
): Promise<StorefrontComparePageStatusResolution> {
  if (comparePageStatusBreaker.isOpen()) {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: 'circuit-open',
    });
    return { kind: 'renderable-or-unknown' };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { [INTERNAL_AUTH_HEADER]: secret },
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: storefrontInternalPreflight.getFetchErrorReason(error),
    });
    recordComparePageStatusFailure(failOpenContext);
    return { kind: 'renderable-or-unknown' };
  }

  const body = await storefrontInternalPreflight.readJsonResponse(
    response,
    failOpenContext
  );
  if (body === null) {
    // A 4xx is a request-specific rejection (for example, a trimmed-empty
    // query rejected by the internal route), not evidence that this instance's
    // internal transport is unhealthy. Keep it fail-open without poisoning the
    // shared breaker for unrelated storefront probes.
    if (!isRequestSpecificClientError(response)) {
      recordComparePageStatusFailure(failOpenContext);
    }
    return { kind: 'renderable-or-unknown' };
  }

  const parsedBody = internalComparePageStatusBodySchema.safeParse(body);
  if (!parsedBody.success) {
    recordComparePageStatusFailure(failOpenContext);
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'parse',
    });
    return { kind: 'renderable-or-unknown' };
  }

  if (parsedBody.data.hasError) {
    // The route deliberately encodes resolver unknowns and caught data/cache
    // failures as a valid fail-open body. The HTTP round trip succeeded, so it
    // must clear any prior transport-failure streak.
    comparePageStatusBreaker.recordSuccess();
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'has-error',
    });
    return { kind: 'renderable-or-unknown' };
  }

  if (parsedBody.data.present) {
    comparePageStatusBreaker.recordSuccess();
    return { kind: 'renderable-or-unknown' };
  }

  comparePageStatusBreaker.recordSuccess();
  return { kind: 'missing' };
}

function skipForComparePageStatusConcurrency(
  failOpenContext: ComparePageStatusFailOpenContext
): StorefrontComparePageStatusResolution {
  storefrontInternalPreflight.warnSkip({
    ...failOpenContext,
    reason: 'concurrency-limit',
  });
  return { kind: 'renderable-or-unknown' };
}

/**
 * Resolve a compare-pair hard-status verdict before PPR can flush the page.
 * The internal endpoint owns the data read and uses the same bounded inventory
 * + maintained-manifest policy as the page loader; this edge-side module only
 * authenticates the transport and maps an explicit positive absence.
 *
 * Every transport, schema, safety, draft, and degraded-resolver uncertainty
 * fails open. Only `{ present: false, hasError: false }` becomes `missing`.
 */
export async function resolveStorefrontComparePageStatus(
  opts: ComparePageStatusOptions
): Promise<StorefrontComparePageStatusResolution> {
  const failOpenContext = {
    surface: 'compare-page-status' as const,
    identifier: opts.identifier,
    slug: opts.comparisonSlug,
  };

  const categorySafety = evaluateStorefrontSlugSafety(opts.categorySlug);
  if (!categorySafety.safe) {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      slug: opts.categorySlug,
      reason: categorySafety.reason,
    });
    return { kind: 'renderable-or-unknown' };
  }

  // The composite route segment is intentionally not checked as one product
  // slug. Validate its decoded halves instead, preserving the long-key form
  // supported by the compare loader while still bounding cache inputs.
  if (opts.comparisonSlug.length > MAX_COMPARE_STATUS_COMPOSITE_LENGTH) {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: 'too-long',
    });
    return { kind: 'renderable-or-unknown' };
  }
  const parsed = parseCompareSlug(opts.comparisonSlug);
  if (parsed) {
    const leftSafety = evaluateStorefrontSlugSafety(parsed.leftKey);
    if (!leftSafety.safe) {
      storefrontInternalPreflight.warnSkip({
        ...failOpenContext,
        reason: leftSafety.reason,
      });
      return { kind: 'renderable-or-unknown' };
    }
    const rightSafety = evaluateStorefrontSlugSafety(parsed.rightKey);
    if (!rightSafety.safe) {
      storefrontInternalPreflight.warnSkip({
        ...failOpenContext,
        reason: rightSafety.reason,
      });
      return { kind: 'renderable-or-unknown' };
    }
  }

  if (!opts.secret) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-secret',
    });
    return { kind: 'renderable-or-unknown' };
  }

  const baseUrl = storefrontInternalPreflight.resolveBaseUrl(opts.origin);
  if (!baseUrl) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
    return { kind: 'renderable-or-unknown' };
  }

  const url = `${baseUrl}/api/internal/compare-page-status/${encodeURIComponent(
    opts.identifier
  )}?category=${encodeURIComponent(opts.categorySlug)}&comparison=${encodeURIComponent(
    opts.comparisonSlug
  )}`;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const requestKey = comparePageStatusRequestKey(url, opts.secret);
  const pending = comparePageStatusInFlight.get(requestKey);
  if (pending) {
    return await pending;
  }
  if (comparePageStatusInFlight.size >= MAX_COMPARE_PAGE_STATUS_IN_FLIGHT) {
    return skipForComparePageStatusConcurrency(failOpenContext);
  }

  const next = resolveStorefrontComparePageStatusUncached(
    opts,
    opts.secret,
    url,
    fetchImpl,
    failOpenContext
  );
  comparePageStatusInFlight.set(requestKey, next);
  try {
    return await next;
  } finally {
    if (comparePageStatusInFlight.get(requestKey) === next) {
      comparePageStatusInFlight.delete(requestKey);
    }
  }
}

/** Test hook: clears the per-instance storm guards between isolated cases. */
export function resetStorefrontComparePageStatusForTests(): void {
  comparePageStatusInFlight.clear();
  comparePageStatusBreaker.reset();
}
