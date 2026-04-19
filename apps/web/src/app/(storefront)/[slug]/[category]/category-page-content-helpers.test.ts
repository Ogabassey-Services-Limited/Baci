import { describe, expect, it } from 'vitest';
import { normalizeCategoryPageProducts } from './category-page-content-helpers';

describe('normalizeCategoryPageProducts', () => {
  it('uses the route category slug for multi-category products', () => {
    const [result] = normalizeCategoryPageProducts(
      [
        {
          id: 'prod-1',
          name: 'Galaxy Z Fold',
          slug: 'galaxy-z-fold',
          description: 'Foldable phone',
          price: 1200000,
          condition: 'new',
          stock: 4,
          images: ['https://cdn.example.com/fold.png'],
          categories: [
            {
              name: 'Featured',
              slug: 'featured',
            },
            {
              name: 'Smartphones',
              slug: 'smartphones',
            },
          ],
          product_key_specs: {
            ram_gb: 12,
            storage_gb: 512,
          },
        },
      ],
      'smartphones'
    );

    expect(result.category).toBe('Smartphones');
    expect(result.category_slug).toBe('smartphones');
  });

  it('keeps the first category when it already matches the route category', () => {
    const [result] = normalizeCategoryPageProducts(
      [
        {
          id: 'prod-2',
          name: 'iPhone 16',
          slug: 'iphone-16',
          description: 'Flagship phone',
          price: 1500000,
          condition: 'new',
          stock: 8,
          images: ['https://cdn.example.com/iphone-16.png'],
          categories: [{ name: 'Smartphones', slug: 'smartphones' }],
        },
      ],
      'smartphones'
    );

    expect(result.category).toBe('Smartphones');
    expect(result.category_slug).toBe('smartphones');
  });

  it('falls back to the first available category when the route category is absent', () => {
    const [result] = normalizeCategoryPageProducts(
      [
        {
          id: 'prod-3',
          name: 'Galaxy Book',
          slug: 'galaxy-book',
          description: 'Windows laptop',
          price: 1750000,
          condition: 'new',
          stock: 5,
          images: ['https://cdn.example.com/galaxy-book.png'],
          categories: [
            { name: 'Laptops', slug: 'laptops' },
            { name: 'Featured', slug: 'featured' },
          ],
        },
      ],
      'smartphones'
    );

    expect(result.category).toBe('Laptops');
    expect(result.category_slug).toBe('laptops');
  });

  it('returns an empty array when there are no products to normalize', () => {
    expect(normalizeCategoryPageProducts([], 'smartphones')).toEqual([]);
  });
});
