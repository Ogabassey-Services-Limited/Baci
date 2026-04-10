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

  it('derives parent inventory and variant summaries for structured variants', () => {
    const parsed = ProductDbSchema.parse({
      name: 'iPhone 14 Pro',
      sku: 'IP14PRO',
      price: 0,
      cost_price: 500000,
      stock_quantity: 0,
      description: 'A phone',
      category_id: '',
      manage_stock: false,
      status: 'active',
      images: [],
      has_variants: true,
      variant_attributes: [],
      variants: [
        {
          attributes: [
            { key: 'storage', value: '128GB' },
            { key: 'color', value: 'Black' },
          ],
          cost_price: 700000,
          price: 900000,
          sku: 'IP14PRO-128-BLK',
          stock_quantity: 2,
        },
        {
          attributes: [
            { key: 'storage', value: '256GB' },
            { key: 'color', value: 'Silver' },
          ],
          cost_price: 750000,
          price: 950000,
          sku: 'IP14PRO-256-SLV',
          stock_quantity: 4,
        },
      ],
    });

    expect(parsed.price).toBe(900000);
    expect(parsed.stock_quantity).toBe(6);
    expect(parsed.stock).toBe(6);
    expect(parsed.manage_stock).toBe(true);
    expect(parsed.variant_attributes).toEqual({
      color: ['Black', 'Silver'],
      storage: ['128GB', '256GB'],
    });
    expect(parsed.variants).toEqual([
      {
        attributes: { color: 'Black', storage: '128GB' },
        cost_price: 700000,
        id: undefined,
        images: [],
        primary_image: null,
        price_override: 900000,
        sku: 'IP14PRO-128-BLK',
        stock_quantity: 2,
      },
      {
        attributes: { color: 'Silver', storage: '256GB' },
        cost_price: 750000,
        id: undefined,
        images: [],
        primary_image: null,
        price_override: 950000,
        sku: 'IP14PRO-256-SLV',
        stock_quantity: 4,
      },
    ]);
  });

  it('rejects variant products without variants', () => {
    expect(() =>
      ProductDbSchema.parse({
        name: 'Variant Parent',
        sku: 'VAR-001',
        price: 0,
        stock_quantity: 0,
        category_id: '',
        manage_stock: true,
        status: 'active',
        images: [],
        has_variants: true,
        variant_attributes: [],
        variants: [],
      })
    ).toThrow('Add at least one variant before saving.');
  });

  it('rejects duplicate variant attribute combinations', () => {
    expect(() =>
      ProductDbSchema.parse({
        name: 'Duplicate Variant Parent',
        sku: 'VAR-002',
        price: 0,
        stock_quantity: 0,
        category_id: '',
        manage_stock: true,
        status: 'active',
        images: [],
        has_variants: true,
        variant_attributes: [],
        variants: [
          {
            attributes: [{ key: 'storage', value: '128GB' }],
            price: 500,
            stock_quantity: 1,
          },
          {
            attributes: [{ key: 'storage', value: '128GB' }],
            price: 600,
            stock_quantity: 1,
          },
        ],
      })
    ).toThrow('Duplicate variants must be merged or changed.');
  });
});
