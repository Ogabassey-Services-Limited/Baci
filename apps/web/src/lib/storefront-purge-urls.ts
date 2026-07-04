import { STOREFRONT_PUBLIC_CACHE_POLICIES } from '@/config/storefront-cache';

/**
 * Build the canonical public URLs to evict from Cloudflare when a storefront's
 * blog content changes. Only storefronts with a configured public cache policy
 * (i.e. a Cloudflare-fronted custom domain) produce URLs; everyone else returns
 * an empty list so the purge is a no-op.
 *
 * `identifiers` may be either a merchant slug (e.g. `ogabassey`) or one of the
 * policy's custom hostnames — both resolve to the same policy.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePurgeHostnames(identifier: string): readonly string[] {
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
 * Dedup path segments by their normalized (trim + lowercase) form and drop
 * blanks, but KEEP the original casing for the emitted URL: the CDN path is
 * case-sensitive, so lowercasing here would purge the wrong URL for a
 * mixed-case segment.
 */
function dedupePathSegmentsPreservingCasing(
  segments: readonly string[]
): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const segment of segments) {
    const normalized = normalize(segment);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(segment.trim());
  }
  return deduped;
}

export function buildStorefrontBlogPurgeUrls(
  identifiers: readonly string[],
  postSlugs: readonly string[],
  categorySlugs: readonly string[] = []
): string[] {
  const urls = new Set<string>();

  const dedupedSlugs = dedupePathSegmentsPreservingCasing(postSlugs);
  const dedupedCategorySlugs =
    dedupePathSegmentsPreservingCasing(categorySlugs);

  for (const identifier of identifiers) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      urls.add(`https://${hostname}/blog`);
      for (const slug of dedupedSlugs) {
        urls.add(`https://${hostname}/blog/${encodeURIComponent(slug)}`);
      }
      // A post moving into or out of a category changes that category's
      // listing page (/blog/category/<slug>), which shares the same raised
      // edge TTL as /blog and the per-post URLs, so it must be evicted too.
      for (const categorySlug of dedupedCategorySlugs) {
        urls.add(
          `https://${hostname}/blog/category/${encodeURIComponent(categorySlug)}`
        );
      }
    }
  }

  return Array.from(urls);
}
