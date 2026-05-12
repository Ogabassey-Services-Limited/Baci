import { describe, expect, it } from 'vitest';
import {
  buildStorefrontProductsCacheKeyParts,
  buildStorefrontProductsCacheTags,
} from '@/lib/storefront-products-cache-key';

describe('buildStorefrontProductsCacheTags', () => {
  it('scopes storefront product cache tags by merchant ID', () => {
    expect(buildStorefrontProductsCacheTags('merchant-1')).toEqual([
      'storefront-products-merchant-1',
      'merchant-id-merchant-1',
    ]);
  });

  it('trims merchant IDs before building tags', () => {
    expect(buildStorefrontProductsCacheTags('  merchant-1  ')).toEqual([
      'storefront-products-merchant-1',
      'merchant-id-merchant-1',
    ]);
  });

  it('preserves hyphenated merchant IDs and long IDs', () => {
    const merchantId = `merchant-${'a'.repeat(80)}-with-hyphens`;

    expect(buildStorefrontProductsCacheTags(merchantId)).toEqual([
      `storefront-products-${merchantId}`,
      `merchant-id-${merchantId}`,
    ]);
  });

  it('rejects blank merchant IDs to avoid global cache tags', () => {
    expect(() => buildStorefrontProductsCacheTags('')).toThrow(
      'merchantId cannot be empty'
    );
    expect(() => buildStorefrontProductsCacheTags('   ')).toThrow(
      'merchantId cannot be empty'
    );
    expect(() =>
      buildStorefrontProductsCacheTags(undefined as unknown as string)
    ).toThrow('merchantId must be a string');
  });
});

describe('buildStorefrontProductsCacheKeyParts', () => {
  it('normalizes merchant IDs consistently with cache tags', () => {
    expect(
      buildStorefrontProductsCacheKeyParts('  merchant-1  ', {
        sort: 'newest',
      })
    ).toEqual(['storefront-products', 'merchant-1', 'sort-newest']);
  });

  it('treats false like an unset has_images filter while keeping true distinct', () => {
    const unset = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
    });
    const disabled = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
      has_images: false,
    });
    const enabled = buildStorefrontProductsCacheKeyParts('merchant-1', {
      sort: 'newest',
      has_images: true,
    });

    expect(unset).not.toContain('img-true');
    expect(disabled).not.toContain('img-true');
    expect(enabled).toContain('img-true');
    expect(disabled).toEqual(unset);
    expect(enabled).not.toEqual(unset);
    expect(enabled).not.toEqual(disabled);
  });

  it('preserves zero price bounds and normalizes search queries before truncation', () => {
    expect(
      buildStorefrontProductsCacheKeyParts('merchant-1', {
        sort: 'newest',
        min_price: 0,
        max_price: 0,
        q: `  ${'A'.repeat(120)}  `,
      })
    ).toEqual(
      expect.arrayContaining(['min-0', 'max-0', `q-${'a'.repeat(100)}`])
    );
  });

  it('normalizes brand casing and ignores blank brand filters', () => {
    expect(
      buildStorefrontProductsCacheKeyParts('merchant-1', {
        sort: 'newest',
        brand: ' Sony ',
      })
    ).toContain('brand-sony');

    expect(
      buildStorefrontProductsCacheKeyParts('merchant-1', {
        sort: 'newest',
        brand: '   ',
      })
    ).not.toContain(expect.stringMatching(/^brand-/));
  });
});
