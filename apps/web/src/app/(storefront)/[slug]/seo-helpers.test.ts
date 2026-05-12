import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  getStorefrontCountryDisplayName,
  getStorefrontSeoDescription,
  getStorefrontSeoTagline,
  getStorefrontSeoTitle,
  normalizeStorefrontBusinessType,
  type StorefrontSeoMerchant,
} from './seo-helpers';

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
    ['food-beverage', 'Order Fresh Food Online'],
    ['pharmaceuticals', 'Shop Pharmacy Essentials Online'],
    ['health-beauty', 'Shop Beauty and Wellness Essentials'],
    ['hair-extensions', 'Shop Premium Hair Extensions'],
    ['home-goods', 'Shop Home Essentials Online'],
    ['fashion', 'Shop Fashion and Style Online'],
    ['handmade', 'Shop Handmade Goods Online'],
    ['electronics', 'Buy Gadgets Pay Later'],
  ])('returns industry-specific copy for %s', (businessType, expected) => {
    expect(getStorefrontSeoTagline(businessType)).toBe(expected);
  });

  it('returns generic copy for unknown / missing business types', () => {
    expect(getStorefrontSeoTagline(undefined)).toBe('Shop Online');
    expect(getStorefrontSeoTagline(null)).toBe('Shop Online');
    expect(getStorefrontSeoTagline('unknown-type')).toBe('Shop Online');
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
    ).toBe('Shop Foodflow - order fresh food online with secure checkout.');
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
    ).toBe(
      'Shop Foodflow - order fresh food online with secure checkout in Nigeria.'
    );
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
    ).toBe(
      'Shop CarePoint - shop pharmacy essentials online with secure checkout in Ghana.'
    );
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
    ).toBe(
      'Shop GlobalCo - shop fashion and style online with secure checkout.'
    );

    expect(
      getStorefrontSeoDescription(
        makeMerchant({
          business_name: 'GlobalCo',
          business_type: 'fashion',
          country: 'XX',
        })
      )
    ).toBe(
      'Shop GlobalCo - shop fashion and style online with secure checkout.'
    );
  });
});

describe('getStorefrontSeoTitle', () => {
  it('uses site_title verbatim when set and not a stale gadget title', () => {
    expect(
      getStorefrontSeoTitle(
        makeMerchant({
          business_name: 'CarePoint',
          business_type: 'pharmaceuticals',
          site_title: 'CarePoint Pharmacy',
        })
      )
    ).toBe('CarePoint Pharmacy');
  });

  it('replaces the stale "Buy Gadgets Pay Later" title for non-electronics stores', () => {
    expect(
      getStorefrontSeoTitle(
        makeMerchant({
          business_name: 'Medplus',
          business_type: 'pharmaceuticals',
          site_title: 'Medplus | Buy Gadgets Pay Later',
        })
      )
    ).toBe('Medplus | Shop Pharmacy Essentials Online');
  });

  it('keeps the gadget title for electronics stores', () => {
    expect(
      getStorefrontSeoTitle(
        makeMerchant({
          business_name: 'GadgetHub',
          business_type: 'electronics',
          site_title: 'GadgetHub | Buy Gadgets Pay Later',
        })
      )
    ).toBe('GadgetHub | Buy Gadgets Pay Later');
  });

  it('composes a fallback title when site_title is missing', () => {
    expect(
      getStorefrontSeoTitle(
        makeMerchant({
          business_name: 'Foodflow',
          business_type: 'food-beverage',
        })
      )
    ).toBe('Foodflow | Order Fresh Food Online');
  });

  it('treats whitespace-only custom titles as missing', () => {
    expect(
      getStorefrontSeoTitle(
        makeMerchant({
          business_name: 'Foodflow',
          business_type: 'food-beverage',
          site_title: '   ',
        })
      )
    ).toBe('Foodflow | Order Fresh Food Online');
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
