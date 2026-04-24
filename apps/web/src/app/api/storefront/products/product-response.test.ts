import { describe, expect, it } from 'vitest';
import type { RawDbProduct } from '@/lib/normalize-product';
import {
  mapStorefrontProduct,
  STOREFRONT_PRODUCTS_COMPACT_SELECT,
  STOREFRONT_PRODUCTS_FULL_SELECT,
} from './product-response';

/**
 * Parse a Supabase select fragment string into top-level tokens so tests can
 * assert exact field membership instead of relying on brittle substring checks.
 *
 * Strips nested `relation(...)` parens so top-level relation aliases like
 * `categories:category_id(id, name)` are preserved but their inner fields are
 * removed, and the result is a flat list of top-level tokens separated by
 * commas (ignoring whitespace/newlines).
 */
function parseSelectTokens(fragment: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of fragment) {
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === ',' && depth === 0) {
      const token = current.trim();
      if (token) {
        tokens.push(token);
      }
      current = '';
      continue;
    }
    // Only collect characters at the top level so nested relation fields
    // (e.g. `product_categories (categories (id, name, slug))`) do not leak
    // inner fields into the top-level token list.
    if (depth === 0) {
      current += char;
    }
  }

  const trailing = current.trim();
  if (trailing) {
    tokens.push(trailing);
  }

  return tokens;
}

describe('product-response', () => {
  it('includes canonical storefront select fragments', () => {
    const fullTokens = parseSelectTokens(STOREFRONT_PRODUCTS_FULL_SELECT);
    const compactTokens = parseSelectTokens(STOREFRONT_PRODUCTS_COMPACT_SELECT);

    expect(fullTokens).toContain('category_id');
    // `product_categories` is an aliased relation like
    // `product_categories:product_categories(...)` — strip the alias if present.
    const normalize = (token: string) => token.split(':')[0].trim();
    expect(fullTokens.map(normalize)).toContain('product_categories');

    expect(compactTokens).toContain('image_hint');
    // `categories:category_id(...)` is a top-level relation alias.
    expect(compactTokens).toContain('categories:category_id');
  });

  it('maps storefront product images and defaults consistently', () => {
    const rawProduct: RawDbProduct = {
      id: 'product-1',
      name: 'Samsung Galaxy Z Fold',
      price: 1800000,
      stock: 7,
      category_id: 'cat-1',
      categories: {
        id: 'cat-1',
        name: 'Smartphones',
        slug: 'smartphones',
      },
      images: [
        'https://cdn.example.com/fold-front.png',
        {
          url: 'https://cdn.example.com/fold-back.png',
          alt: 'Rear angle',
          order: 7,
        },
        { alt: 'Missing URL' },
      ],
      color_images: {
        Black: 'https://cdn.example.com/black.png',
        Silver: 'https://cdn.example.com/silver.png',
      },
    };

    const mapped = mapStorefrontProduct(rawProduct);

    // Missing/null `manage_stock` defaults to `false` (unmanaged) to match the
    // storefront contract used by `lib/products-server.ts` and the catalog
    // product mappers.
    expect(mapped.manage_stock).toBe(false);
    expect(mapped.brand).toBe('');
    expect(mapped.category_id).toBe('cat-1');
    expect(mapped.categories).toEqual({
      id: 'cat-1',
      name: 'Smartphones',
      slug: 'smartphones',
    });
    expect(mapped.colors).toEqual(['Black', 'Silver']);
    expect(mapped.images).toEqual([
      {
        url: 'https://cdn.example.com/fold-front.png',
        alt: 'Samsung Galaxy Z Fold',
        order: 0,
      },
      {
        url: 'https://cdn.example.com/fold-back.png',
        alt: 'Rear angle',
        order: 7,
      },
      {
        url: '',
        alt: 'Missing URL',
        order: 2,
      },
    ]);
  });

  it('preserves explicit manage_stock=false when set on the product', () => {
    const rawProduct: RawDbProduct = {
      id: 'product-unmanaged',
      name: 'Infinite Stock Item',
      price: 1000,
      stock: 0,
      images: [],
      manage_stock: false,
    };

    const mapped = mapStorefrontProduct(rawProduct);

    expect(mapped.manage_stock).toBe(false);
  });

  it('prefers explicit colors over color_images keys', () => {
    const rawProduct: RawDbProduct = {
      id: 'product-2',
      name: 'MacBook Pro',
      price: 2500000,
      stock: 3,
      category: 'Laptops',
      images: ['https://cdn.example.com/macbook.png'],
      colors: ['Space Black', 'Silver'],
      color_images: {
        Midnight: 'https://cdn.example.com/midnight.png',
      },
    };

    const mapped = mapStorefrontProduct(rawProduct);

    expect(mapped.colors).toEqual(['Space Black', 'Silver']);
  });
});
