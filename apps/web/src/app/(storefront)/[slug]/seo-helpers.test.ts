import { describe, expect, it } from 'vitest';
import {
  getStorefrontCountryDisplayName,
  getStorefrontSeoDescription,
  getStorefrontSeoTagline,
  normalizeStorefrontBusinessType,
  type StorefrontSeoMerchant,
} from '@/app/(storefront)/[slug]/seo-helpers';
import type { CachedMerchant } from '@/lib/cached-data';

function makeMerchant(
  overrides: Partial<StorefrontSeoMerchant> = {}
): StorefrontSeoMerchant {
  return {
    business_name: 'Test Store',
    business_type: null,
    site_description: null,
    site_tagline: null,
    site_title: null,
    country: null,
    ...overrides,
  } as StorefrontSeoMerchant;
}

describe('normalizeStorefrontBusinessType', () => {
  it.each([
    ['food-beverage', 'food'],
    ['pharmaceuticals', 'pharmacy'],
    ['health-beauty', 'beauty'],
    ['hair-extensions', 'hair'],
    ['home-goods', 'home'],
  ])('maps %s -> %s', (input, expected) => {
    expect(normalizeStorefrontBusinessType(input)).toBe(expected);
  });

  it('normalizes whitespace and casing before mapping business types', () => {
    expect(normalizeStorefrontBusinessType(' Electronics ')).toBe(
      'electronics'
    );
    expect(normalizeStorefrontBusinessType('PHARMACEUTICALS')).toBe('pharmacy');
  });

  it('returns the input verbatim for unknown business types', () => {
    expect(normalizeStorefrontBusinessType('handmade')).toBe('handmade');
    expect(normalizeStorefrontBusinessType('fashion')).toBe('fashion');
  });

  it('falls back to "general" when business type is missing', () => {
    expect(normalizeStorefrontBusinessType(undefined)).toBe('general');
    expect(normalizeStorefrontBusinessType(null)).toBe('general');
    expect(normalizeStorefrontBusinessType('')).toBe('general');
  });
});

describe('getStorefrontSeoTagline', () => {
  it.each([
    'food-beverage',
    'pharmaceuticals',
    'health-beauty',
    'hair-extensions',
    'home-goods',
    'fashion',
    'handmade',
    'electronics',
  ])('uses neutral storefront copy for %s', (businessType) => {
    expect(getStorefrontSeoTagline(businessType)).toBe('Storefront');
  });

  it('uses neutral storefront copy for unknown / missing business types', () => {
    expect(getStorefrontSeoTagline(undefined)).toBe('Storefront');
    expect(getStorefrontSeoTagline(null)).toBe('Storefront');
    expect(getStorefrontSeoTagline('unknown-type')).toBe('Storefront');
  });

  it.each([
    'Buy Gadgets Pay Later',
    'Premium Hair Extensions',
    'Fresh Food',
  ])('never infers the unsupported fallback claim %s', (claim) => {
    expect(getStorefrontSeoTagline('electronics')).not.toContain(claim);
    expect(getStorefrontSeoTagline('hair-extensions')).not.toContain(claim);
    expect(getStorefrontSeoTagline('food-beverage')).not.toContain(claim);
  });
});

describe('getStorefrontCountryDisplayName', () => {
  it.each([
    ['NG', 'Nigeria'],
    ['GH', 'Ghana'],
    ['KE', 'Kenya'],
    ['ZA', 'South Africa'],
    ['ng', 'Nigeria'],
    ['  gh  ', 'Ghana'],
  ])('maps %s -> %s', (code, expected) => {
    expect(getStorefrontCountryDisplayName(code)).toBe(expected);
  });

  it('returns null for unknown / empty / missing codes', () => {
    expect(getStorefrontCountryDisplayName(null)).toBeNull();
    expect(getStorefrontCountryDisplayName(undefined)).toBeNull();
    expect(getStorefrontCountryDisplayName('')).toBeNull();
    expect(getStorefrontCountryDisplayName('XX')).toBeNull();
  });
});

describe('getStorefrontSeoDescription', () => {
  it('prefers explicit site_description when set', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({ site_description: 'Custom store description.' })
      )
    ).toBe('Custom store description.');
  });

  it('falls back to site_tagline when site_description is missing', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          site_description: undefined,
          site_tagline: 'Curated picks for you.',
        })
      )
    ).toBe('Curated picks for you.');
  });

  it('treats whitespace-only custom description fields as missing', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'Foodflow',
          business_type: 'food-beverage',
          site_description: '   ',
          site_tagline: '   ',
        })
      )
    ).toBe('Foodflow storefront.');
  });

  it('sanitizes custom description fields before returning metadata', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          site_description: '  <strong>Custom</strong> store description.  ',
        })
      )
    ).toBe('Custom store description.');
  });

  it('removes dangerous HTML from custom descriptions before returning metadata', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          site_description:
            '<script src="https://example.com/xss.js"></script>Store description',
        })
      )
    ).toBe('Store description');
  });

  it('sanitizes merchant names when composing default descriptions', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: ' <strong>Foodflow</strong> ',
          business_type: 'food-beverage',
        })
      )
    ).toBe('Foodflow storefront.');
  });

  it('removes dangerous HTML attributes from merchant names in default descriptions', () => {
    const description = getStorefrontSeoDescription(
      makeMerchant({
        business_name: '<img src=x onerror="alert(1)">Store',
        business_type: 'food-beverage',
      })
    );

    expect(description).toBe('Store storefront.');
    expect(description).not.toContain('onerror');
  });

  it('composes an industry-aware description including the merchant country', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'Foodflow',
          business_type: 'food-beverage',
          country: 'NG',
        })
      )
    ).toBe('Foodflow storefront in NG.');
  });

  it('uses other supported countries dynamically (no NG hardcoding)', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'CarePoint',
          business_type: 'pharmaceuticals',
          country: 'GH',
        })
      )
    ).toBe('CarePoint storefront in GH.');
  });

  it('omits country phrasing when the merchant country is unknown / missing', () => {
    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'GlobalCo',
          business_type: 'fashion',
          country: undefined,
        })
      )
    ).toBe('GlobalCo storefront.');

    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'GlobalCo',
          business_type: 'fashion',
          country: 'XX',
        })
      )
    ).toBe('GlobalCo storefront.');
  });
});

// Compile-time guard: ensure StorefrontSeoMerchant stays a subset of CachedMerchant.
type _StorefrontSeoMerchantIsSubset =
  StorefrontSeoMerchant extends Pick<
    CachedMerchant,
    keyof StorefrontSeoMerchant
  >
    ? true
    : never;

const _assertStorefrontSeoMerchantIsSubset: _StorefrontSeoMerchantIsSubset = true;
void _assertStorefrontSeoMerchantIsSubset;
