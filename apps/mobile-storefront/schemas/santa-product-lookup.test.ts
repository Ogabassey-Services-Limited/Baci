import { describe, expect, it } from '@jest/globals';
import { santaProductLookupResponseSchema } from './santa-product-lookup';

describe('santaProductLookupResponseSchema', () => {
  it('accepts a found Santa product with the fields used by mobile cart', () => {
    const result = santaProductLookupResponseSchema.safeParse({
      product: {
        id: 'prod-1',
        name: 'iPhone 15',
        price: 950_000,
        image: 'https://img/iphone.jpg',
        manage_stock: true,
        slug: 'iphone-15',
        stock: 5,
        ignoredByClient: 'allowed by Zod object stripping',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.product).toEqual({
      id: 'prod-1',
      name: 'iPhone 15',
      price: 950_000,
      image: 'https://img/iphone.jpg',
      manage_stock: true,
      slug: 'iphone-15',
      stock: 5,
    });
  });

  it('accepts null Supabase-backed optional product fields', () => {
    const result = santaProductLookupResponseSchema.safeParse({
      product: {
        id: 'prod-1',
        name: 'iPhone 15',
        price: 950_000,
        image: null,
        manage_stock: null,
        slug: null,
        stock: null,
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.product).toMatchObject({
      image: null,
      manage_stock: null,
      slug: null,
      stock: null,
    });
  });

  it('accepts a null product result', () => {
    expect(
      santaProductLookupResponseSchema.safeParse({ product: null }).success
    ).toBe(true);
  });

  it('rejects malformed product payloads', () => {
    expect(
      santaProductLookupResponseSchema.safeParse({
        product: { id: 'prod-1', name: 'iPhone 15', price: '950000' },
      }).success
    ).toBe(false);
  });
});
