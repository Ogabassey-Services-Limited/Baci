import {
  type CachedMerchant,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';

/**
 * Like getMerchantByIdentifier, but falls back to the retired-slug alias table
 * when the identifier is a slug the store renamed away from.
 *
 * Body-based storefront routes (e.g. social-auth starts) receive the merchant
 * slug in the REQUEST BODY, which the proxy can't rewrite. Without this fallback,
 * a customer with an open tab on a just-renamed store keeps sending the retired
 * slug and 404s. A LIVE merchant always wins (the direct lookup runs first).
 */
export async function getMerchantByIdentifierOrAlias(
  identifier: string
): Promise<CachedMerchant | null> {
  const merchant = await getMerchantByIdentifier(identifier);
  if (merchant) {
    return merchant;
  }

  const normalized = identifier.trim().toLowerCase();
  const currentSlug = await getCurrentSlugForAlias(normalized);
  if (currentSlug && currentSlug !== normalized) {
    return getMerchantByIdentifier(currentSlug);
  }

  return null;
}
