import { describe, expect, it } from 'vitest';
import { ProductDbSchema } from '@/lib/validators/product';

describe('ProductDbSchema', () => {
  it('keeps stock and stock_quantity in sync for inserts and updates', () => {
    const parsed = ProductDbSchema.parse({
      name: 'Phone',
      sku: 'SKU-123',
      price: 1000,
      cost_price: 500,
      stock_quantity: 8,
      low_stock_threshold: 3,
      description: 'A phone',
      category_id: '',
      color: 'Black',
      manage_stock: true,
      status: 'active',
      images: [],
      variant_attributes: [],
      fulfillment_details: { items: [] },
    });

    expect(parsed.stock_quantity).toBe(8);
    expect(parsed.stock).toBe(8);
    expect(parsed.category_id).toBeNull();
  });

  it('keeps explicit stock values when stock management is disabled', () => {
    const parsed = ProductDbSchema.parse({
      name: 'Digital Product',
      sku: 'DIGI-001',
      price: 2500,
      cost_price: 0,
      stock_quantity: 12,
      description: 'Delivered instantly',
      category_id: '',
      manage_stock: false,
      status: 'active',
      images: [],
      variant_attributes: [],
      fulfillment_details: { items: [] },
    });

    expect(parsed.manage_stock).toBe(false);
    expect(parsed.stock_quantity).toBe(12);
    expect(parsed.stock).toBe(12);
    expect(parsed.category_id).toBeNull();
  });

  it('accepts zero stock quantities and keeps the mirrored stock field aligned', () => {
    const parsed = ProductDbSchema.parse({
      name: 'Empty Shelf',
      sku: 'EMPTY-001',
      price: 100,
      stock_quantity: 0,
      category_id: '',
      manage_stock: true,
      status: 'draft',
      images: [],
      variant_attributes: [],
    });

    expect(parsed.stock_quantity).toBe(0);
    expect(parsed.stock).toBe(0);
    expect(parsed.category_id).toBeNull();
  });

  it('rejects missing stock_quantity values', () => {
    expect(() =>
      ProductDbSchema.parse({
        name: 'Missing Stock',
        sku: 'MISS-001',
        price: 100,
        category_id: '',
        manage_stock: true,
        status: 'active',
        images: [],
        variant_attributes: [],
      })
    ).toThrow();
  });

  it('rejects negative stock quantities', () => {
    expect(() =>
      ProductDbSchema.parse({
        name: 'Negative Stock',
        sku: 'NEG-001',
        price: 100,
        stock_quantity: -1,
        category_id: '',
        manage_stock: true,
        status: 'active',
        images: [],
        variant_attributes: [],
      })
    ).toThrow();
  });
});
