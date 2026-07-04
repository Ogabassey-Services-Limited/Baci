import { STOREFRONT_PUBLIC_CACHE_POLICIES } from '@/config/storefront-cache';

/**
 * Shared helpers for building the canonical public URLs to evict from Cloudflare
 * when a storefront's content changes. Used by both the blog
 * (`storefront-purge-urls.ts`) and product (`storefront-product-purge-urls.ts`)
 * URL builders.
 *
 * An `identifier` may be either a merchant slug (e.g. `ogabassey`) or one of the
 * policy's custom hostnames — both resolve to the same policy. Storefronts
 * without a configured public cache policy (i.e. no Cloudflare-fronted custom
 * domain) resolve to no hostnames, so the purge is a no-op.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve a merchant slug OR one of its custom hostnames to the policy's custom
 * hostnames. Returns an empty list when the identifier is blank or matches no
 * public cache policy.
 */
export function resolvePurgeHostnames(identifier: string): readonly string[] {
  const normalized = normalize(identifier);
  if (!normalized) {
    return [];
  }

  for (const policy of STOREFRONT_PUBLIC_CACHE_POLICIES) {
    const matchesSlug = policy.slug.toLowerCase() === normalized;
    const matchesHostname = policy.customHostnames.some(
      (hostname) => hostname.toLowerCase() === normalized
    );
    if (matchesSlug || matchesHostname) {
      return policy.customHostnames;
    }
  }

  return [];
}

/**
 * Dedup path segments by their trimmed value and drop blanks, but KEEP the
 * original casing for the emitted URL: the CDN path is case-sensitive, so
 * lowercasing here would purge the wrong URL for a mixed-case segment.
 *
 * Dedupe is CASE-SENSITIVE on the trimmed value: CDN cache keys are
 * case-sensitive URLs, so two segments differing only by casing are two
 * distinct cached entries and BOTH must be purged (e.g. a case-only rename
 * queues the old and new slug). Blank segments are dropped.
 */
export function dedupePathSegmentsPreservingCasing(
  segments: readonly string[]
): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    deduped.push(trimmed);
  }
  return deduped;
}
