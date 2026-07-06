import { describe, expect, it, vi } from 'vitest';
import type { ProductWithVariants } from './products.types';

vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-0000-0000-00000000abcd',
}));

import { buildProductEditFormData } from './product-edit-form-data';

function makeProduct(
  overrides: Partial<ProductWithVariants> = {}
): ProductWithVariants {
  return {
    id: 'prod-1',
    name: 'iPhone 15',
    description: '<p>Great phone</p>',
    price: 1000,
    cost_price: 600,
    stock_quantity: 5,
    sku: 'SKU-1',
    slug: 'iphone-15',
    images: ['https://cdn/phone.jpg'],
    status: 'active',
    category: 'Smartphones',
    category_id: 'cat-1',
    brand: null,
    color: 'Black',
    fulfillment_details: null,
    variant_attributes: null,
    has_variants: false,
    manage_stock: true,
    low_stock_threshold: 3,
    variants: [],
    ...overrides,
  } as unknown as ProductWithVariants;
}

describe('buildProductEditFormData', () => {
  it('maps core fields, strips HTML, and falls back to the joined brand name', () => {
    const formData = buildProductEditFormData(
      makeProduct({ brand: null, brands: { name: 'Apple' } })
    );

    expect(formData.brand).toBe('Apple');
    expect(formData.name).toBe('iPhone 15');
    expect(formData.category_id).toBe('cat-1');
    expect(formData.description).toBe('Great phone');
    expect(formData.status).toBe('active');
  });

  it('normalizes existing fulfillment items, preserving imei/serial and id', () => {
    const formData = buildProductEditFormData(
      makeProduct({
        // Stored fulfillment items carry an `id` at runtime (outside the strict
        // Product type), which normalization must preserve.
        fulfillment_details: {
          items: [{ id: 'item-1', imei: '111', serial_number: 'SN1' }],
        } as unknown as ProductWithVariants['fulfillment_details'],
      })
    );

    expect(formData.fulfillment_details.items).toEqual([
      { id: 'item-1', imei: '111', serial_number: 'SN1' },
    ]);
  });

  it('generates fallback fulfillment drafts from stock when no items exist', () => {
    const formData = buildProductEditFormData(
      makeProduct({ fulfillment_details: null, stock_quantity: 2 })
    );

    expect(formData.fulfillment_details.items).toHaveLength(2);
    expect(formData.fulfillment_details.items[0]).toEqual({
      id: '00000000-0000-0000-0000-00000000abcd',
      imei: '',
      serial_number: '',
    });
  });

  it('maps variant_attributes into keyed drafts', () => {
    const formData = buildProductEditFormData(
      makeProduct({ variant_attributes: { size: 'L' } })
    );

    expect(formData.variant_attributes).toEqual([
      { id: '00000000-0000-0000-0000-00000000abcd', key: 'size', value: 'L' },
    ]);
  });
});
