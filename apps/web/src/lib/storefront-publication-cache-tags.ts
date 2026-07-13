import { getStorefrontPublicationCacheTag } from '@/lib/storefront-publication-cache-tag';
import { resolvePurgeHostnames } from '@/lib/storefront-purge-shared';

interface StorefrontPublicationCacheTagsInput {
  customDomains: readonly string[];
  merchantSlugs: readonly string[];
}

function addCustomDomainAliases(hostnames: Set<string>, domain: string): void {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) {
    return;
  }

  hostnames.add(normalizedDomain);
  hostnames.add(
    normalizedDomain.startsWith('www.')
      ? normalizedDomain.slice('www.'.length)
      : `www.${normalizedDomain}`
  );
}

/**
 * Build every tenant-scoped Vercel response tag that can identify a
 * storefront: its platform slug plus its custom-domain aliases.
 */
export function buildStorefrontPublicationCacheTags({
  customDomains,
  merchantSlugs,
}: StorefrontPublicationCacheTagsInput): string[] {
  const tags = new Set<string>();
  const hostnames = new Set<string>();

  for (const merchantSlug of merchantSlugs) {
    const slugTag = getStorefrontPublicationCacheTag({
      kind: 'slug',
      value: merchantSlug,
    });
    if (slugTag) {
      tags.add(slugTag);
    }

    for (const hostname of resolvePurgeHostnames(merchantSlug)) {
      hostnames.add(hostname);
    }
  }

  for (const customDomain of customDomains) {
    addCustomDomainAliases(hostnames, customDomain);
    for (const hostname of resolvePurgeHostnames(customDomain)) {
      hostnames.add(hostname);
    }
  }

  for (const hostname of hostnames) {
    const hostnameTag = getStorefrontPublicationCacheTag({
      kind: 'hostname',
      value: hostname,
    });
    if (hostnameTag) {
      tags.add(hostnameTag);
    }
  }

  return Array.from(tags);
}
