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

  it('includes legacy offer fallbacks for new and used prefilters', () => {
    expect(
      storefrontProductsRouteData.getConditionPrefilterClauses('new')
    ).toEqual(
      expect.arrayContaining([
        'condition.eq.new',
        'available_conditions.cs.{new}',
        'has_condition_offers.eq.true',
      ])
    );

    expect(
      storefrontProductsRouteData.getConditionPrefilterClauses('used')
    ).toEqual(
      expect.arrayContaining([
        'condition.eq.used',
        'condition.eq.uk_used',
        'available_conditions.cs.{used}',
        'available_conditions.cs.{uk_used}',
        'has_condition_offers.eq.true',
      ])
    );
  });

  it('returns no SQL condition prefilter clauses for unsupported values', () => {
    expect(
      storefrontProductsRouteData.getConditionPrefilterClauses('bogus')
    ).toEqual([]);
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

  it('falls back to the singular color field when denormalized colors are absent', () => {
    expect(
      storefrontProductsRouteData.mapProduct({
        id: 'product-1b',
        name: 'Pepper Mix',
        description: null,
        price: 4500,
        compare_at_price: null,
        images: ['https://example.com/pepper-mix.jpg'],
        image_hint: null,
        category: 'Spices',
        categories: { id: 'cat-2', name: 'Spices', slug: 'spices' },
        category_id: 'cat-2',
        brand: 'Foodseed',
        stock: 12,
        stock_quantity: 12,
        slug: 'pepper-mix',
        status: 'active',
        condition: 'new',
        has_variants: false,
        sku: 'PM-1',
        manage_stock: true,
        low_stock_threshold: 2,
        specifications: null,
        has_condition_offers: false,
        available_conditions: [],
        variant_model: 'single',
        offers: [],
        color: 'Red',
        variant_attributes: [],
      }).colors
    ).toEqual(['Red']);
  });

  it('selects the singular color column for storefront queries', () => {
    expect(storefrontProductsRouteData.STOREFRONT_PRODUCTS_SELECT).toMatch(
      /\bcolor\b/
    );
    expect(storefrontProductsRouteData.STOREFRONT_PRODUCTS_SELECT).not.toMatch(
      /\bcolors\b/
    );
  });

  it('preserves explicit image order zero values', () => {
    expect(
      storefrontProductsRouteData.mapProduct({
        id: 'product-2',
        name: 'DualSense Controller',
        description: '',
        price: 85000,
        compare_at_price: null,
        images: [
          {
            url: 'https://example.com/controller.jpg',
            alt: 'Controller',
            order: 0,
          },
        ],
        image_hint: null,
        category: 'Gaming',
        categories: { id: 'cat-1', name: 'Gaming', slug: 'gaming' },
        category_id: 'cat-1',
        brand: 'Sony',
        stock: 5,
        stock_quantity: 5,
        slug: 'dualsense-controller',
        status: 'active',
        condition: 'new',
        has_variants: false,
        sku: 'DS-1',
        manage_stock: true,
        low_stock_threshold: 1,
        specifications: null,
        has_condition_offers: false,
        available_conditions: [],
        variant_model: 'single',
        offers: [],
        colors: ['White'],
        variant_attributes: [],
      }).images[0]?.order
    ).toBe(0);
  });
});
