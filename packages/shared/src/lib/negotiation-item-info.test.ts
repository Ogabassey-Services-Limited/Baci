import { describe, expect, it } from 'vitest';
import { buildNegotiationSingleItemInfo } from './negotiation-item-info';

describe('buildNegotiationSingleItemInfo', () => {
  it('trims optional string metadata and variant attributes', () => {
    expect(
      buildNegotiationSingleItemInfo({
        itemId: ' item-1 ',
        productName: ' iPhone 14 Pro Max ',
        productBrand: ' Apple ',
        currentPrice: 875_000,
        productSlug: ' iphone-14-pro-max ',
        variantId: ' variant-256 ',
        variantName: ' Deep Purple / 256GB ',
        variantAttributes: {
          ' color ': ' Deep Purple ',
          storage: ' 256GB ',
        },
        condition: ' used ',
      })
    ).toEqual({
      id: 'item-1',
      name: 'iPhone 14 Pro Max',
      brand: 'Apple',
      current_price: 875_000,
      product_slug: 'iphone-14-pro-max',
      variant_id: 'variant-256',
      variant_name: 'Deep Purple / 256GB',
      variant_attributes: {
        color: 'Deep Purple',
        storage: '256GB',
      },
      condition: 'used',
    });
  });

  it('drops empty optional fields and malformed variant attributes', () => {
    expect(
      buildNegotiationSingleItemInfo({
        itemId: ' ',
        productName: 'Samsung Galaxy S26',
        productBrand: '',
        currentPrice: 950_000,
        productSlug: ' ',
        variantAttributes: {
          empty: ' ',
          ' ': 'ignored',
          storage: '512GB',
        },
        condition: ' ',
      })
    ).toEqual({
      name: 'Samsung Galaxy S26',
      current_price: 950_000,
      variant_attributes: {
        storage: '512GB',
      },
    });
  });

  it('omits invalid current prices from the persisted item info', () => {
    expect(
      buildNegotiationSingleItemInfo({
        productName: 'Samsung Galaxy S26',
        currentPrice: Number.NaN,
      })
    ).toEqual({ name: 'Samsung Galaxy S26' });

    expect(
      buildNegotiationSingleItemInfo({
        productName: 'Samsung Galaxy S26',
        currentPrice: -1,
      })
    ).toEqual({ name: 'Samsung Galaxy S26' });
  });
});
