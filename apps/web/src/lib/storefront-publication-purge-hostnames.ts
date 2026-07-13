import { resolvePurgeHostnames } from '@/lib/storefront-purge-shared';

/**
 * Resolve a publication transition to every Cloudflare-fronted hostname for
 * that merchant. Unknown storefronts intentionally produce no hostnames.
 */
export function buildStorefrontPublicationPurgeHostnames(
  identifiers: readonly string[]
): string[] {
  const hostnames = new Set<string>();

  for (const identifier of identifiers) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      hostnames.add(hostname);
    }
  }

  return Array.from(hostnames);
}
