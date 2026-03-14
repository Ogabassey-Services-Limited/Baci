import { describe, expect, it } from 'vitest';
import {
  normalizeStorefrontProductVariants,
  type StorefrontVariantRecord,
} from './storefront-product-variants';

describe('normalizeStorefrontProductVariants', () => {
  it('returns an empty array when the storefront has no variants', () => {
    expect(
      normalizeStorefrontProductVariants([], {
        merchantId: 'merchant-empty',
        productId: 'product-empty',
      })
    ).toEqual([]);
  });

  it('normalizes public RPC variant rows into shared storefront variants', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-1',
            product_id: 'product-1',
            merchant_id: 'merchant-1',
            attributes: {
              'SIM Type': ' eSIM Only ',
              storage: '256GB',
            },
            price_override: '129999',
            stock_quantity: 4,
            images: ['https://cdn.example.com/1.png'],
            primary_image: 'https://cdn.example.com/1.png',
            sku: 'SKU-1',
          },
        ],
        {
          merchantId: 'fallback-merchant',
          productId: 'fallback-product',
        }
      )
    ).toEqual([
      {
        id: 'variant-1',
        product_id: 'product-1',
        merchant_id: 'merchant-1',
        attributes: {
          sim_type: 'eSIM Only',
          storage: '256GB',
        },
        price_override: 129999,
        stock_quantity: 4,
        images: ['https://cdn.example.com/1.png'],
        primary_image: 'https://cdn.example.com/1.png',
        sku: 'SKU-1',
      },
    ]);
  });

  it('fills missing product and merchant ids from the page context', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-2',
            attributes: { storage: '128GB' },
            stock_quantity: 1,
          },
        ],
        {
          merchantId: 'merchant-2',
          productId: 'product-2',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-2',
        merchant_id: 'merchant-2',
        product_id: 'product-2',
      }),
    ]);
  });

  it('defaults null stock_quantity to 0 and drops null price_override', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-3',
            attributes: { storage: '512GB' },
            price_override: null,
            stock_quantity: null,
          },
        ],
        {
          merchantId: 'merchant-3',
          productId: 'product-3',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-3',
        price_override: undefined,
        stock_quantity: 0,
      }),
    ]);
  });

  it('rejects loosely numeric strings and trims variant image URLs', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-4',
            attributes: { storage: '1TB' },
            price_override: '123abc',
            stock_quantity: 2,
            images: ['  https://cdn.example.com/4.png  ', '   '],
          },
        ],
        {
          merchantId: 'merchant-4',
          productId: 'product-4',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-4',
        price_override: undefined,
        images: ['https://cdn.example.com/4.png'],
      }),
    ]);
  });

  it('trims primary images and coerces stock quantities to whole units', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-5',
            attributes: { storage: '256GB' },
            primary_image: '  https://cdn.example.com/5.png  ',
            stock_quantity: 2.9,
          },
        ],
        {
          merchantId: 'merchant-5',
          productId: 'product-5',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-5',
        primary_image: 'https://cdn.example.com/5.png',
        stock_quantity: 2,
      }),
    ]);
  });

  it('drops variants whose ids are empty after trimming', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: '   ',
            attributes: { storage: '256GB' },
          },
        ],
        {
          merchantId: 'merchant-6',
          productId: 'product-6',
        }
      )
    ).toEqual([]);
  });

  it('drops variants with missing or undefined ids', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            attributes: { storage: '128GB' },
          } as unknown as StorefrontVariantRecord,
          {
            id: undefined as unknown as string,
            attributes: { storage: '256GB' },
          },
        ],
        {
          merchantId: 'merchant-7',
          productId: 'product-7',
        }
      )
    ).toEqual([]);
  });

  it('clamps negative stock quantities to zero', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-8',
            attributes: { storage: '128GB' },
            stock_quantity: -5,
          },
        ],
        {
          merchantId: 'merchant-8',
          productId: 'product-8',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-8',
        stock_quantity: 0,
      }),
    ]);
  });

  it('drops negative variant price overrides', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-9',
            attributes: { storage: '256GB' },
            price_override: -2500,
          },
        ],
        {
          merchantId: 'merchant-9',
          productId: 'product-9',
        }
      )
    ).toEqual([
      expect.objectContaining({
        id: 'variant-9',
        price_override: undefined,
      }),
    ]);
  });
});
