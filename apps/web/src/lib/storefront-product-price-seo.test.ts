import { describe, expect, it } from 'vitest';
import {
  buildProductPriceSeoCopy,
  formatProductPriceRange,
  getProductPriceRange,
} from '@/lib/storefront-product-price-seo';

describe('getProductPriceRange', () => {
  it('uses variants and condition offers to compute a product price range', () => {
    const range = getProductPriceRange({
      name: 'iPhone XR',
      price: 230000,
      variants: [
        { price_override: 180000 },
        { price_override: 220000 },
        { price_override: 300000 },
      ],
      offers: [{ price: 200000 }],
    });

    expect(range).toEqual({
      min: 180000,
      max: 300000,
      hasRange: true,
    });
  });

  it('falls back to the product sale or base price when variants are absent', () => {
    const range = getProductPriceRange({
      name: 'Samsung Galaxy A57',
      sale_price: 415000,
      base_price: 450000,
    });

    expect(range).toEqual({
      min: 415000,
      max: 450000,
      hasRange: true,
    });
  });

  it('returns null when no usable price exists', () => {
    expect(
      getProductPriceRange({
        name: 'Custom Device',
        price: null,
        variants: [{ price_override: null }],
      })
    ).toBeNull();
  });
});

describe('formatProductPriceRange', () => {
  it('formats Nigerian currency without decimals', () => {
    expect(
      formatProductPriceRange(
        { min: 180000, max: 300000, hasRange: true },
        'NGN'
      )
    ).toBe('₦180,000 - ₦300,000');
  });

  it('formats single-price ranges with only the minimum price', () => {
    expect(
      formatProductPriceRange(
        { min: 180000, max: 300000, hasRange: false },
        'NGN'
      )
    ).toBe('₦180,000');
  });
});

describe('buildProductPriceSeoCopy', () => {
  it('builds exact-match device price copy for ranged product families', () => {
    const copy = buildProductPriceSeoCopy({
      product: {
        name: 'iPhone 13',
        price: 430000,
        min_variant_price: 390000,
        max_variant_price: 520000,
      },
      merchantDisplayName: 'Ogabassey',
      categoryName: 'Smartphones',
      currency: 'NGN',
    });

    expect(copy.title).toBe('iPhone 13 Price in Nigeria');
    expect(copy.description).toContain(
      'iPhone 13 price in Nigeria starts from ₦390,000 on Ogabassey'
    );
    expect(copy.answer).toContain(
      'The iPhone 13 price in Nigeria on Ogabassey starts from ₦390,000 and goes up to ₦520,000'
    );
  });

  it('builds direct price copy for single-price products', () => {
    const copy = buildProductPriceSeoCopy({
      product: {
        name: 'HP Laptop 14',
        price: 645600,
      },
      merchantDisplayName: 'Ogabassey',
      categoryName: 'Laptops',
      currency: 'NGN',
    });

    expect(copy.answer).toContain(
      'The HP Laptop 14 price in Nigeria on Ogabassey is ₦645,600'
    );
  });

  it('builds generic check-price copy when no price is available', () => {
    const copy = buildProductPriceSeoCopy({
      product: {
        name: 'Custom Device',
        price: null,
      },
      merchantDisplayName: 'Ogabassey',
      categoryName: 'Electronics',
      currency: 'NGN',
    });

    expect(copy.title).toBe('Custom Device Price in Nigeria');
    expect(copy.description).toContain(
      'Check Custom Device price in Nigeria on Ogabassey'
    );
    expect(copy.answer).toContain(
      'Check the current Custom Device price in Nigeria on Ogabassey'
    );
    expect(copy.priceText).toBeNull();
    expect(copy.range).toBeNull();
  });
});
