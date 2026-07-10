import { describe, expect, it } from 'vitest';
import { mapHomeProductsToTemplateProducts } from '@/app/(storefront)/ogabassey/ogabassey-home-product-adapter';
import { PRODUCT_STATUS_ACTIVE } from '@/lib/products';

type HomeProduct = Parameters<
  typeof mapHomeProductsToTemplateProducts
>[0][number];

function createHomeProduct(overrides: Partial<HomeProduct> = {}): HomeProduct {
  return {
    id: 'product-1',
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
    description: 'Apple flagship phone.',
    price: 2_500_000,
    compare_at_price: null,
    images: [{ url: '/iphone.jpg', alt: 'iPhone', order: 0 }],
    category: 'Smartphones',
    brand: 'Apple',
    condition: 'new',
    stock: 4,
    stock_quantity: null,
    manage_stock: false,
    low_stock_threshold: null,
    product_categories: [{ categories: [{ name: 'Phones', slug: 'phones' }] }],
    ...overrides,
  };
}

describe('mapHomeProductsToTemplateProducts', () => {
  it('maps minimal homepage products to the shared Product contract', () => {
    const [product] = mapHomeProductsToTemplateProducts([createHomeProduct()]);

    expect(product).toEqual(
      expect.objectContaining({
        id: 'product-1',
        name: 'iPhone 17 Pro Max',
        status: PRODUCT_STATUS_ACTIVE,
        manage_stock: false,
        stock: 4,
        image: '/iphone.jpg',
        imageLarge: '/iphone.jpg',
        imageHint: 'Apple',
        gtin: '',
        mpn: '',
        category_slug: 'phones',
        categories: expect.objectContaining({
          name: 'Phones',
          slug: 'phones',
        }),
        condition: 'new',
      })
    );
  });

  it('preserves mixed-condition selection capability for home cards', () => {
    const [product] = mapHomeProductsToTemplateProducts([
      createHomeProduct({ has_condition_offers: true }),
    ]);

    expect(product.has_condition_offers).toBe(true);
  });

  it('normalizes loose image and category relation shapes', () => {
    const [product] = mapHomeProductsToTemplateProducts([
      createHomeProduct({
        condition: 'unsupported',
        images: [' /front.jpg ', { url: '/back.jpg', order: 4 }],
        product_categories: [
          { categories: [{ name: 'Gadgets', slug: 'gadgets' }] },
        ],
        stock: null,
        stock_quantity: 7,
      }),
    ]);

    expect(product.condition).toBeUndefined();
    expect(product.stock).toBe(7);
    expect(product.images).toEqual([
      { url: '/front.jpg', alt: 'iPhone 17 Pro Max', order: 0 },
      { url: '/back.jpg', alt: 'iPhone 17 Pro Max', order: 4 },
    ]);
    expect(product.categories).toEqual(
      expect.objectContaining({
        name: 'Gadgets',
        slug: 'gadgets',
      })
    );
  });

  it('normalizes string and missing row prices to the Product number contract', () => {
    const [stringPriceProduct, missingPriceProduct] =
      mapHomeProductsToTemplateProducts([
        createHomeProduct({ price: '12345.67' }),
        createHomeProduct({ id: 'product-2', price: null }),
      ]);

    expect(stringPriceProduct.price).toBe(12_345.67);
    expect(missingPriceProduct.price).toBe(0);
  });

  it('falls back to the direct category_id relation when join-table categories are absent', () => {
    const [product] = mapHomeProductsToTemplateProducts([
      createHomeProduct({
        category: null,
        product_categories: [],
        categories: {
          id: 'cat-smartphones',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: 'cat-devices',
        },
      } as Partial<HomeProduct> & { categories: Record<string, string> }),
    ]);

    expect(product.category_slug).toBe('smartphones');
    expect(product.categories).toEqual({
      id: 'cat-smartphones',
      name: 'Smartphones',
      slug: 'smartphones',
      parent_id: 'cat-devices',
    });
  });

  it('prefers the direct category_id relation over stale join-table categories', () => {
    const [product] = mapHomeProductsToTemplateProducts([
      createHomeProduct({
        category: null,
        product_categories: [
          { categories: [{ name: 'Stale Gadgets', slug: 'gadgets' }] },
        ],
        categories: {
          id: 'cat-smartphones',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: 'cat-devices',
        },
      } as Partial<HomeProduct> & { categories: Record<string, string> }),
    ]);

    expect(product.category_slug).toBe('smartphones');
    expect(product.categories).toEqual({
      id: 'cat-smartphones',
      name: 'Smartphones',
      slug: 'smartphones',
      parent_id: 'cat-devices',
    });
  });
});
