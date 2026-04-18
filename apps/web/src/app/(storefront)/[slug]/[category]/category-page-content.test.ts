import { describe, expect, it } from 'vitest';
import { normalizeCategoryPageProducts } from './category-page-content';

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
});
