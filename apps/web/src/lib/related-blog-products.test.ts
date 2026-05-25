import { describe, expect, it } from 'vitest';
import {
  normalizeRelatedBlogProducts,
  RELATED_BLOG_PRODUCTS_SELECT,
} from '@/lib/related-blog-products';

describe('related blog products', () => {
  it('selects the canonical product category relation instead of a missing legacy column', () => {
    expect(RELATED_BLOG_PRODUCTS_SELECT).toContain(
      'categories:category_id!inner(slug)'
    );
    expect(RELATED_BLOG_PRODUCTS_SELECT).not.toMatch(/\bcategory_slug\b/);
  });

  it('projects the joined category slug into the blog product link shape', () => {
    expect(
      normalizeRelatedBlogProducts([
        {
          id: 'product-1',
          name: 'Laptop',
          slug: 'laptop',
          categories: { slug: 'laptops' },
        },
      ])
    ).toEqual([
      {
        id: 'product-1',
        name: 'Laptop',
        slug: 'laptop',
        category_slug: 'laptops',
      },
    ]);
  });

  it('handles absent and collection category relation results', () => {
    expect(normalizeRelatedBlogProducts(null)).toEqual([]);
    expect(normalizeRelatedBlogProducts(undefined)).toEqual([]);
    expect(
      normalizeRelatedBlogProducts([
        {
          id: 'product-1',
          name: 'Uncategorized',
          slug: 'uncategorized',
          categories: [],
        },
        {
          id: 'product-2',
          name: 'Missing slug',
          slug: 'missing-slug',
          categories: { slug: null },
        },
        {
          id: 'product-3',
          name: 'Multi relation',
          slug: 'multi-relation',
          categories: [{ slug: 'laptops' }, { slug: 'electronics' }],
        },
      ])
    ).toEqual([
      {
        id: 'product-1',
        name: 'Uncategorized',
        slug: 'uncategorized',
        category_slug: null,
      },
      {
        id: 'product-2',
        name: 'Missing slug',
        slug: 'missing-slug',
        category_slug: null,
      },
      {
        id: 'product-3',
        name: 'Multi relation',
        slug: 'multi-relation',
        category_slug: 'laptops',
      },
    ]);
  });
});
