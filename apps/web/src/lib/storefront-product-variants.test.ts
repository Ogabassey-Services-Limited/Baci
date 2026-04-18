import { describe, expect, it } from 'vitest';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';

describe('normalizeStorefrontProductVariants', () => {
  it('normalizes public RPC variant rows into ProductVariant records', () => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-1',
            product_id: 'product-1',
            merchant_id: 'merchant-1',
            condition: 'used',
            attributes: {
              sim_type: ' eSIM Only ',
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
        condition: 'used',
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

  it('drops null numeric values instead of leaking invalid numbers', () => {
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

  it.each([
    ['new', 'new'],
    ['used', 'used'],
    ['refurbished', 'open_box'],
    ['uk_used', 'used'],
    [undefined, undefined],
    ['unexpected', undefined],
  ] as const)('normalizes condition %s to %s', (inputCondition, expectedCondition) => {
    expect(
      normalizeStorefrontProductVariants(
        [
          {
            id: 'variant-condition',
            attributes: { storage: '128GB' },
            condition: inputCondition,
            stock_quantity: 3,
          },
        ],
        {
          merchantId: 'merchant-4',
          productId: 'product-4',
        }
      )[0]?.condition
    ).toBe(expectedCondition);
  });
});
