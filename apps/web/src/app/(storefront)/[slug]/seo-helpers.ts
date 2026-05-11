import type { CachedMerchant } from '@/lib/cached-data';

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
  switch (businessType) {
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
      return businessType || 'general';
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

export function getStorefrontSeoDescription(
  merchant: StorefrontSeoMerchant
): string {
  if (merchant.site_description || merchant.site_tagline) {
    return merchant.site_description || merchant.site_tagline || '';
  }

  const tagline = getStorefrontSeoTagline(merchant.business_type).toLowerCase();
  const countryName = getStorefrontCountryDisplayName(merchant.country);
  const suffix = countryName ? ` in ${countryName}` : '';
  return `Shop ${merchant.business_name} - ${tagline} with secure checkout${suffix}.`;
}

export function getStorefrontSeoTitle(merchant: StorefrontSeoMerchant): string {
  const hasMismatchedGadgetTitle =
    normalizeStorefrontBusinessType(merchant.business_type) !== 'electronics' &&
    /buy gadgets pay later/i.test(merchant.site_title || '');

  if (merchant.site_title && !hasMismatchedGadgetTitle) {
    return merchant.site_title;
  }

  return `${merchant.business_name} | ${getStorefrontSeoTagline(
    merchant.business_type
  )}`;
}
