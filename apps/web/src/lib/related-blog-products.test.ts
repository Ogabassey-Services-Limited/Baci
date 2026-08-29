import { describe, expect, it } from 'vitest';
import {
  normalizeRelatedBlogProductLinks,
  normalizeRelatedBlogProducts,
  RELATED_BLOG_PRODUCT_LINKS_SELECT,
  RELATED_BLOG_PRODUCTS_SELECT,
} from '@/lib/related-blog-products';

describe('related blog products', () => {
  it('selects the canonical product category relation instead of a missing legacy column', () => {
    expect(RELATED_BLOG_PRODUCTS_SELECT).toContain(
      'categories:category_id!inner(slug)'
    );
    expect(RELATED_BLOG_PRODUCT_LINKS_SELECT).toContain(
      'products!blog_post_products_product_id_fkey'
    );
    expect(RELATED_BLOG_PRODUCTS_SELECT).toContain('price, compare_at_price');
    expect(RELATED_BLOG_PRODUCT_LINKS_SELECT).toContain(
      'price, compare_at_price'
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

  it('normalizes live catalog prices without inventing missing values', () => {
    expect(
      normalizeRelatedBlogProducts([
        {
          id: 'product-1',
          name: 'Phone',
          slug: 'phone',
          price: '250000.00',
          compare_at_price: 275000,
          categories: { slug: 'smartphones' },
        },
        {
          id: 'product-2',
          name: 'Unpriced item',
          slug: 'unpriced-item',
          price: null,
          categories: { slug: 'accessories' },
        },
      ])
    ).toEqual([
      {
        id: 'product-1',
        name: 'Phone',
        slug: 'phone',
        price: 250000,
        compare_at_price: 275000,
        category_slug: 'smartphones',
      },
      {
        id: 'product-2',
        name: 'Unpriced item',
        slug: 'unpriced-item',
        category_slug: 'accessories',
      },
    ]);
  });

  it('projects explicit blog product links and ignores inactive linked products', () => {
    expect(
      normalizeRelatedBlogProductLinks([
        {
          product: {
            id: 'product-1',
            name: 'iPad 10th Gen',
            slug: 'ipad-10th-gen-2022',
            status: 'active',
            categories: { slug: 'tablets' },
          },
        },
        {
          product: {
            id: 'product-2',
            name: 'Inactive iPad',
            slug: 'inactive-ipad',
            status: 'draft',
            categories: { slug: 'tablets' },
          },
        },
      ])
    ).toEqual([
      {
        id: 'product-1',
        name: 'iPad 10th Gen',
        slug: 'ipad-10th-gen-2022',
        category_slug: 'tablets',
      },
    ]);
  });
});
