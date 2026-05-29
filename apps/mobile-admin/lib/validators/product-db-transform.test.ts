import { describe, expect, it } from 'vitest';
import type { ProductFormValues } from './product';
import { mapProductFormToProductDb } from './product-db-transform';

describe('mapProductFormToProductDb', () => {
  it('mirrors inventory fields and nulls blank category ids', () => {
    const result = mapProductFormToProductDb({
      category_id: '',
      brand: undefined,
      color: ' Black ',
      cost_price: 500,
      description: undefined,
      fulfillment_details: { items: [] },
      has_variants: false,
      images: [],
      manage_stock: true,
      name: 'Phone',
      price: 1000,
      sku: 'SKU-123',
      status: 'active',
      stock_quantity: 8,
      variant_attributes: [{ key: 'Brand', value: 'Apple' }],
      variants: [],
    } satisfies ProductFormValues);

    expect(result.category_id).toBeNull();
    expect(result.stock).toBe(8);
    expect(result.stock_quantity).toBe(8);
    expect(result.variant_attributes).toEqual({ Brand: 'Apple' });
    expect(result.variants).toEqual([]);
  });

  it('projects variant records when variants are enabled', () => {
    const result = mapProductFormToProductDb({
      category_id: undefined,
      brand: undefined,
      color: 'Black',
      cost_price: 0,
      description: undefined,
      fulfillment_details: { items: [] },
      has_variants: true,
      images: [],
      manage_stock: true,
      name: 'Phone',
      price: 1000,
      sku: 'SKU-123',
      status: 'active',
      stock_quantity: 1,
      variant_attributes: [],
      variants: [
        {
          attributes: [{ key: 'Storage', value: '128GB' }],
          condition: 'new',
          cost_price: 600,
          images: [],
          price: 1200,
          primary_image: null,
          sku: 'SKU-128',
          stock_quantity: 3,
        },
      ],
    } satisfies ProductFormValues);

    expect(result.stock).toBe(3);
    expect(result.variant_attributes).toEqual({ Storage: ['128GB'] });
    expect(result.variants).toEqual([
      expect.objectContaining({
        attributes: { Storage: '128GB' },
        condition: 'new',
        price_override: 1200,
        sku: 'SKU-128',
        stock_quantity: 3,
      }),
    ]);
  });
});
