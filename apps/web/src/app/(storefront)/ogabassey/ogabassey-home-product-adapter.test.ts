import { describe, expect, it } from 'vitest';
import { mapHomeProductsToTemplateProducts } from '@/app/(storefront)/ogabassey/ogabassey-home-product-adapter';

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
        status: 'active',
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
});
