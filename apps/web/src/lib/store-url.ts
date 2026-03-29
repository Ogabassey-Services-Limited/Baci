import { getRootDomain } from '@/env';
import type { CachedMerchant } from '@/lib/cached-data';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

/**
 * Build the canonical base URL for a merchant's storefront.
 * Returns origin + path prefix. Append route paths directly:
 *   `${buildStoreUrl(merchant)}/products/123`
 *
 * Dev:       http://localhost:3000/ogabassey   (path-mode, slug baked in)
 * Custom:    https://ogabassey.com             (domain-mode, no slug)
 * Subdomain: https://ogabassey.usebaci.com     (domain-mode, no slug)
 */
export function buildStoreUrl(
  merchant: Pick<CachedMerchant, 'slug' | 'custom_domain'>
): string {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:3000/${merchant.slug}`;
  }

  if (merchant.custom_domain) {
    const normalized = merchant.custom_domain
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^\/+|\/+$/g, '');
    const hostnamePattern =
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
    if (normalized && hostnamePattern.test(normalized)) {
      return `https://${normalized}`;
    }
  }

  return `https://${merchant.slug}.${ROOT_DOMAIN}`;
}
