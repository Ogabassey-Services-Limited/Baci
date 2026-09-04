import { describe, expect, it } from 'vitest';
import { createChatProductResult } from './chat-product-result';

describe('createChatProductResult', () => {
  it('preserves the catalog fields required for safe product-card actions', () => {
    const product = {
      brand: 'Apple',
      category: 'Smartphones',
      description: 'Current catalog description',
      has_variants: false,
      id: 'product-1',
      images: [{ url: 'https://cdn.example.com/product.jpg' }],
      manage_stock: true,
      name: 'iPhone 16',
      price: 1_200_000,
      slug: 'iphone-16',
      status: 'active',
      stock: 5,
    };

    const result = createChatProductResult(product);

    expect(result).toEqual({
      brand: 'Apple',
      category: 'Smartphones',
      description: 'Current catalog description',
      has_variants: false,
      id: 'product-1',
      image_url: 'https://cdn.example.com/product.jpg',
      manage_stock: true,
      name: 'iPhone 16',
      price: 1_200_000,
      slug: 'iphone-16',
      status: 'active',
      stock: 5,
    });
  });

  it('does not treat malformed image payloads as renderable URLs', () => {
    const result = createChatProductResult({
      brand: null,
      category: null,
      description: null,
      id: 'product-1',
      images: [{ url: 42 }],
      name: 'Phone',
      price: 10_000,
      status: 'active',
      stock: null,
    });

    expect(result.image_url).toBeNull();
  });
});
