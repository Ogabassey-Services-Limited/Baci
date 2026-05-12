import type { CachedMerchant } from '@/lib/cached-data';
import { sanitizeText } from '@/lib/sanitize-core';

/**
 * Pure SEO helpers for the storefront `[slug]` layout.
 *
 * Extracted from `layout.tsx` so each helper can be unit-tested in isolation
 * (the layout test only verifies them indirectly via `generateMetadata`).
 *
 * Per project rules:
 *   - One responsibility per file
 *   - No NG-only hardcoding — `getStorefrontSeoDescription` resolves the
 *     country dynamically from `merchant.country` (CachedMerchant) and
 *     falls back to country-neutral phrasing when unavailable.
 */

export type StorefrontSeoMerchant = Pick<
  CachedMerchant,
  | 'business_name'
  | 'business_type'
  | 'site_description'
  | 'site_tagline'
  | 'site_title'
  | 'country'
>;

/**
 * ISO-3166-1 alpha-2 country code → display name.
 *
 * Kept intentionally small. New entries can be added as Baci rolls out to
 * additional countries; unknown codes fall through to country-neutral copy.
 */
const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  ZA: 'South Africa',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  CI: "Côte d'Ivoire",
  SN: 'Senegal',
  US: 'the United States',
  GB: 'the United Kingdom',
  CA: 'Canada',
};

export function getStorefrontCountryDisplayName(
  country?: string | null
): string | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  if (!code) return null;
  return COUNTRY_DISPLAY_NAMES[code] ?? null;
}

export function normalizeStorefrontBusinessType(
  businessType?: string | null
): string {
  const normalized = businessType?.trim().toLowerCase();

  switch (normalized) {
    case 'food-beverage':
      return 'food';
    case 'pharmaceuticals':
      return 'pharmacy';
    case 'health-beauty':
      return 'beauty';
    case 'hair-extensions':
      return 'hair';
    case 'home-goods':
      return 'home';
    default:
      return normalized || 'general';
  }
}

export function getStorefrontSeoTagline(businessType?: string | null): string {
  switch (normalizeStorefrontBusinessType(businessType)) {
    case 'food':
      return 'Order Fresh Food Online';
    case 'pharmacy':
      return 'Shop Pharmacy Essentials Online';
    case 'beauty':
      return 'Shop Beauty and Wellness Essentials';
    case 'hair':
      return 'Shop Premium Hair Extensions';
    case 'home':
      return 'Shop Home Essentials Online';
    case 'fashion':
      return 'Shop Fashion and Style Online';
    case 'handmade':
      return 'Shop Handmade Goods Online';
    case 'electronics':
      return 'Buy Gadgets Pay Later';
    default:
      return 'Shop Online';
  }
}

function cleanSeoField(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  return sanitizeText(normalized) || null;
}

export function getStorefrontSeoDescription(
  merchant: StorefrontSeoMerchant
): string {
  const customDescription = cleanSeoField(merchant.site_description);
  const customTagline = cleanSeoField(merchant.site_tagline);
  const businessName = cleanSeoField(merchant.business_name) || 'Store';

  if (customDescription || customTagline) {
    return customDescription || customTagline || '';
  }

  const tagline = getStorefrontSeoTagline(merchant.business_type).toLowerCase();
  const countryName = getStorefrontCountryDisplayName(merchant.country);
  const suffix = countryName ? ` in ${countryName}` : '';
  return `Shop ${businessName} - ${tagline} with secure checkout${suffix}.`;
}

export function getStorefrontSeoTitle(merchant: StorefrontSeoMerchant): string {
  const customTitle = cleanSeoField(merchant.site_title);
  const hasMismatchedGadgetTitle =
    normalizeStorefrontBusinessType(merchant.business_type) !== 'electronics' &&
    /buy gadgets pay later/i.test(customTitle || '');

  if (customTitle && !hasMismatchedGadgetTitle) {
    return customTitle;
  }

  const businessName = cleanSeoField(merchant.business_name) || 'Store';

  return `${businessName} | ${getStorefrontSeoTagline(merchant.business_type)}`;
}
