import { describe, expect, it } from 'vitest';
import { type CachedProductRow, mapCachedProductToProduct } from './products';

describe('mapCachedProductToProduct', () => {
  it('maps modern storefront rows into the shared Product shape', () => {
    const product = mapCachedProductToProduct({
      id: 'product-1',
      merchant_id: 'merchant-1',
      name: 'iPhone 15 Pro',
      description: 'Flagship smartphone',
      status: 'active',
      slug: 'iphone-15-pro',
      price: 1500,
      stock: 3,
      manage_stock: true,
      images: [{ url: 'https://cdn.example.com/iphone-15-pro.jpg' }],
      condition: 'new',
      category: 'Phones',
      categories: {
        id: 'category-1',
        name: 'Smartphones',
        slug: 'smartphones',
      },
      product_variants: [
        {
          id: 'variant-1',
          attributes: { color: 'Black' },
          stock_quantity: 2,
          price_override: 1550,
        },
      ],
      product_offers: [
        {
          id: 'offer-1',
          condition: 'used',
          status: 'active',
          price: 1200,
          stock_quantity: 1,
          images: ['https://cdn.example.com/iphone-15-pro-used.jpg'],
        },
        {
          id: 'offer-2',
          condition: 'new',
          status: 'active',
          price: 1500,
          stock_quantity: 3,
        },
        {
          id: 'offer-3',
          condition: 'used',
          status: 'draft',
          price: 1100,
          stock_quantity: 1,
        },
      ],
    } as CachedProductRow);

    expect(product.image).toBe('https://cdn.example.com/iphone-15-pro.jpg');
    expect(product.imageLarge).toBe(
      'https://cdn.example.com/iphone-15-pro.jpg'
    );
    expect(product.category).toBe('Smartphones');
    expect(product.category_slug).toBe('smartphones');
    expect(product.variants).toHaveLength(1);
    expect(product.variants?.[0]).toMatchObject({
      id: 'variant-1',
      product_id: 'product-1',
      merchant_id: 'merchant-1',
      stock_quantity: 2,
    });
    expect(product.offers).toHaveLength(1);
    expect(product.offers?.[0]).toMatchObject({
      id: 'offer-1',
      condition: 'used',
    });
  });

  it('maps legacy cached rows using base_price and product_categories joins', () => {
    const product = mapCachedProductToProduct(
      {
        id: 'product-2',
        name: 'iPhone 15 Pro',
        status: 'active',
        slug: 'iphone-15-pro',
        base_price: 1500,
        sale_price: 1400,
        quantity: 5,
        track_quantity: true,
        images: ['https://cdn.example.com/iphone-15-pro.jpg'],
        product_categories: [
          {
            categories: {
              id: 'category-1',
              name: 'Smartphones',
              slug: 'smartphones',
            },
          },
        ],
        product_variants: [
          {
            id: 'variant-1',
            attributes: { storage: '128GB' },
            stock_quantity: 4,
          },
        ],
        offers: [
          {
            id: 'offer-1',
            condition: 'used',
            price: '1250',
            stock_quantity: 1,
          },
        ],
      } as CachedProductRow,
      {
        merchantId: 'merchant-legacy',
      }
    );

    expect(product.price).toBe(1400);
    expect(product.compare_at_price).toBe(1500);
    expect(product.manage_stock).toBe(true);
    expect(product.stock).toBe(5);
    expect(product.category).toBe('Smartphones');
    expect(product.category_slug).toBe('smartphones');
    expect(product.imageHint).toBe('iPhone 15 Pro');
    expect(product.variants?.[0]).toMatchObject({
      merchant_id: 'merchant-legacy',
      product_id: 'product-2',
    });
    expect(product.offers?.[0]?.price).toBe(1250);
  });
});
