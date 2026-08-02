import { describe, expect, it } from 'vitest';
import { buildLcpRouteProductProjection } from './lcp-route-product-projection';

describe('buildLcpRouteProductProjection', () => {
  it('normalizes active condition offers and excludes the main condition', () => {
    const projection = buildLcpRouteProductProjection({
      condition: 'new',
      product_offers: [
        {
          condition: 'open_box',
          id: 'open-box-offer',
          images: ['https://cdn.example/open-box.avif'],
          price: '1,200,000',
          status: 'active',
          stock_quantity: '2',
        },
        {
          condition: 'new',
          id: 'main-condition-offer',
          price: 1_300_000,
          status: 'active',
        },
        {
          condition: 'used',
          id: 'inactive-offer',
          price: 900_000,
          status: 'inactive',
        },
        {
          condition: 'used',
          id: 'invalid-price-offer',
          price: 'not-a-price',
          status: 'active',
        },
      ],
      product_variants: [{ id: 'variant-1' }],
    });

    expect(projection).toEqual({
      condition: 'new',
      hasVariantMatrix: true,
      offers: [
        {
          condition: 'open_box',
          id: 'open-box-offer',
          images: ['https://cdn.example/open-box.avif'],
          price: 1_200_000,
          stock_quantity: 2,
        },
      ],
    });
  });

  it('keeps an absent offer collection absent and reports no variant matrix', () => {
    expect(
      buildLcpRouteProductProjection({
        condition: null,
        product_offers: undefined,
        product_variants: [],
      })
    ).toEqual({
      condition: undefined,
      hasVariantMatrix: false,
      offers: undefined,
    });
  });
});
