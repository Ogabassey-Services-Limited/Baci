import { describe, expect, it } from 'vitest';
import { normalizeProduct } from './normalize-product';

describe('normalizeProduct', () => {
  const baseRawProduct = {
    id: 'prod-1',
    name: 'Samsung Galaxy S25',
    slug: 'samsung-galaxy-s25',
    description: 'A flagship phone',
    price: 860000,
    compare_at_price: undefined,
    condition: 'new',
    brand: 'Samsung',
    category: 'Smartphones',
    images: ['https://cdn.example.com/s25.avif'],
    stock: 999,
    stock_quantity: 999,
    rating: 4.5,
    status: 'active',
    merchant_id: 'merchant-1',
  };

  it('normalizes a product with default fields', () => {
    const result = normalizeProduct(baseRawProduct);

    expect(result.id).toBe('prod-1');
    expect(result.name).toBe('Samsung Galaxy S25');
    expect(result.price).toBe(860000);
    expect(result.condition).toBe('new');
    expect(result.has_condition_offers).toBe(false);
  });

  it('maps has_condition_offers when true', () => {
    const result = normalizeProduct({
      ...baseRawProduct,
      has_condition_offers: true,
    });

    expect(result.has_condition_offers).toBe(true);
  });

  it('defaults has_condition_offers to false when missing', () => {
    const result = normalizeProduct(baseRawProduct);
    expect(result.has_condition_offers).toBe(false);
  });

  it('defaults has_condition_offers to false when null', () => {
    const result = normalizeProduct({
      ...baseRawProduct,
      has_condition_offers: undefined,
    });
    expect(result.has_condition_offers).toBe(false);
  });

  it('defaults condition to New when missing', () => {
    const { condition: _, ...noCondition } = baseRawProduct;
    const result = normalizeProduct(noCondition);
    expect(result.condition).toBe('New');
  });
});
