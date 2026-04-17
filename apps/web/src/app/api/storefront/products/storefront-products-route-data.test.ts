import { describe, expect, it } from 'vitest';
import { storefrontProductsRouteData } from './storefront-products-route-data';

describe('storefrontProductsRouteData', () => {
  it('includes legacy condition aliases in SQL prefilter clauses', () => {
    expect(
      storefrontProductsRouteData.getConditionPrefilterClauses('open_box')
    ).toEqual(
      expect.arrayContaining([
        'condition.eq.open_box',
        'condition.eq.refurbished',
        'available_conditions.cs.{open_box}',
        'available_conditions.cs.{refurbished}',
      ])
    );
  });

  it('preserves primary and secondary category memberships', () => {
    expect(
      storefrontProductsRouteData.buildCategoryFilterSource({
        category: 'Legacy Phones',
        categories: { name: 'Smartphones', slug: 'smartphones' },
        product_categories: [
          { categories: { name: 'Featured', slug: 'featured' } },
        ],
      })
    ).toEqual({
      category: 'Legacy Phones',
      categories: [
        { name: 'Smartphones', slug: 'smartphones' },
        { name: 'Featured', slug: 'featured' },
      ],
    });
  });

  it('falls back to color_images keys when colors are absent', () => {
    expect(
      storefrontProductsRouteData.mapProduct({
        id: 'product-1',
        name: 'Console Cover',
        description: null,
        price: 12000,
        compare_at_price: null,
        images: ['https://example.com/image.jpg'],
        image_hint: null,
        category: 'Gaming',
        categories: { id: 'cat-1', name: 'Gaming', slug: 'gaming' },
        category_id: 'cat-1',
        brand: 'Sony',
        stock: 5,
        stock_quantity: 5,
        slug: 'console-cover',
        status: 'active',
        condition: 'new',
        has_variants: false,
        sku: 'CC-1',
        manage_stock: true,
        low_stock_threshold: 1,
        specifications: null,
        has_condition_offers: false,
        available_conditions: [],
        variant_model: 'single',
        offers: [],
        color_images: {
          Black: 'https://example.com/black.jpg',
          White: 'https://example.com/white.jpg',
        },
        variant_attributes: [],
      }).colors
    ).toEqual(['Black', 'White']);
  });
});
