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

export function buildStorefrontBlogPurgeUrls(
  identifiers: readonly string[],
  postSlugs: readonly string[]
): string[] {
  const urls = new Set<string>();

  // Dedup slugs by their normalized (trim + lowercase) form and drop blanks, but
  // KEEP the original casing for the emitted URL: the CDN path is case-sensitive,
  // so lowercasing here would purge the wrong URL for a mixed-case slug.
  const seenNormalizedSlugs = new Set<string>();
  const dedupedSlugs: string[] = [];
  for (const slug of postSlugs) {
    const normalizedSlug = normalize(slug);
    if (!normalizedSlug || seenNormalizedSlugs.has(normalizedSlug)) {
      continue;
    }
    seenNormalizedSlugs.add(normalizedSlug);
    dedupedSlugs.push(slug.trim());
  }

  for (const identifier of identifiers) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      urls.add(`https://${hostname}/blog`);
      for (const slug of dedupedSlugs) {
        urls.add(`https://${hostname}/blog/${encodeURIComponent(slug)}`);
      }
    }
  }

  return Array.from(urls);
}
