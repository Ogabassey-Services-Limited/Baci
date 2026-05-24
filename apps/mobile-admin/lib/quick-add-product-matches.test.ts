import { describe, expect, it } from 'vitest';
import { findQuickAddProductMatches } from './quick-add-product-matches';

const products = [
  {
    condition: null,
    has_variants: false,
    id: 'iphone-11-pro',
    images: [],
    name: 'iPhone 11 Pro',
    parent_product_id: null,
    price: 450000,
    sku: null,
    variant_attributes: [],
  },
  {
    condition: 'used',
    has_variants: false,
    id: 'iphone-11-pro-premium-64',
    images: [],
    name: '64GB Premium Used',
    parent_product_id: 'iphone-11-pro',
    price: 180000,
    sku: null,
    variant_attributes: { storage: '64GB', condition: 'Premium Used' },
  },
  {
    condition: null,
    has_variants: false,
    id: 'pixel-buds',
    images: [],
    name: 'Google Pixel Buds Pro 2',
    parent_product_id: null,
    price: 220000,
    sku: null,
    variant_attributes: [],
  },
];

describe('findQuickAddProductMatches', () => {
  it('returns matching products and variants for a quick-add used phone name', () => {
    const matches = findQuickAddProductMatches({
      customItem: {
        name: 'iPhone 11 Pro 64gb Premium Used',
        price: '180000',
      },
      products,
    });

    expect(matches[0]).toMatchObject({
      id: 'iphone-11-pro-premium-64',
      matchReason: 'variant-and-price',
    });
    expect(matches.map((match) => match.id)).toContain('iphone-11-pro');
	  });

	  it('returns no matches when the custom item has no meaningful token overlap', () => {
	    const customItem = { name: 'Itel Buds Neo 3', price: '20000' };

	    const matches = findQuickAddProductMatches({
	      customItem,
	      products,
	    });

	    expect(matches).toEqual([]);
	  });
	});
