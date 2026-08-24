import { INTERNAL_AUTH_HEADER } from '@/lib/internal-auth-header';
import { parseCompareSlug } from '@/lib/storefront-compare/compare-slugs';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { internalComparePageStatusBodySchema } from '@/schemas/internal-slug-set-route';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

const DEFAULT_TIMEOUT_MS = 2_000;
const MAX_COMPARE_STATUS_COMPOSITE_LENGTH = 1_024;

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

  const parsedBody = internalComparePageStatusBodySchema.safeParse(body);
  if (!parsedBody.success) {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'parse',
    });
    return { kind: 'renderable-or-unknown' };
  }

  if (parsedBody.data.hasError || parsedBody.data.present) {
    if (parsedBody.data.hasError) {
      storefrontInternalPreflight.warnFailOpen({
        ...failOpenContext,
        reason: 'has-error',
      });
    }
    return { kind: 'renderable-or-unknown' };
  }

  return { kind: 'missing' };
}
