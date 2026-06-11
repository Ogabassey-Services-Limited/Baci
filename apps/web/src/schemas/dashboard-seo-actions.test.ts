import { describe, expect, it } from 'vitest';
import {
  generateSEOSuggestionsInputSchema,
  saveSEOSettingsInputSchema,
  seoMerchantIdSchema,
} from './dashboard-seo-actions';

const MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';
const PRODUCT_ID = '1c8e5a2b-4d3c-4f6a-9b8c-0d1e2f3a4b5c';

const validOptimization = {
  productId: PRODUCT_ID,
  meta_title: 'Buy Premium Leather Shoes Online in Nigeria',
  meta_description:
    'Shop premium leather shoes with free shipping across Nigeria. Order durable, stylish footwear today and enjoy quality you can trust.',
  keywords: ['leather shoes', 'buy shoes nigeria'],
};

describe('seoMerchantIdSchema', () => {
  it('accepts a uuid and rejects arbitrary strings', () => {
    expect(seoMerchantIdSchema.safeParse(MERCHANT_ID).success).toBe(true);
    expect(seoMerchantIdSchema.safeParse('merchant-1').success).toBe(false);
  });
});

describe('generateSEOSuggestionsInputSchema', () => {
  it('accepts up to 20 product uuids', () => {
    const result = generateSEOSuggestionsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      productIds: [PRODUCT_ID],
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty product lists', () => {
    const result = generateSEOSuggestionsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      productIds: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects more than 20 products with the batch message', () => {
    const result = generateSEOSuggestionsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      productIds: Array.from({ length: 21 }, () => PRODUCT_ID),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Maximum 20 products per batch'
      );
    }
  });

  it('rejects non-uuid product ids', () => {
    const result = generateSEOSuggestionsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      productIds: ['not-a-uuid'],
    });

    expect(result.success).toBe(false);
  });
});

describe('saveSEOSettingsInputSchema', () => {
  it('accepts a valid optimization batch', () => {
    const result = saveSEOSettingsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      optimizations: [validOptimization],
    });

    expect(result.success).toBe(true);
  });

  it('rejects meta titles longer than 70 characters', () => {
    const result = saveSEOSettingsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      optimizations: [{ ...validOptimization, meta_title: 'a'.repeat(71) }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects meta descriptions longer than 160 characters', () => {
    const result = saveSEOSettingsInputSchema.safeParse({
      merchantId: MERCHANT_ID,
      optimizations: [
        { ...validOptimization, meta_description: 'a'.repeat(161) },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects more than 20 keywords and empty keyword strings', () => {
    expect(
      saveSEOSettingsInputSchema.safeParse({
        merchantId: MERCHANT_ID,
        optimizations: [
          {
            ...validOptimization,
            keywords: Array.from({ length: 21 }, () => 'keyword'),
          },
        ],
      }).success
    ).toBe(false);
    expect(
      saveSEOSettingsInputSchema.safeParse({
        merchantId: MERCHANT_ID,
        optimizations: [{ ...validOptimization, keywords: [''] }],
      }).success
    ).toBe(false);
  });

  it('rejects empty and oversized optimization batches', () => {
    expect(
      saveSEOSettingsInputSchema.safeParse({
        merchantId: MERCHANT_ID,
        optimizations: [],
      }).success
    ).toBe(false);
    expect(
      saveSEOSettingsInputSchema.safeParse({
        merchantId: MERCHANT_ID,
        optimizations: Array.from({ length: 21 }, () => validOptimization),
      }).success
    ).toBe(false);
  });
});
