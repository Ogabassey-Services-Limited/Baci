import { describe, expect, it } from 'vitest';
import {
  mapOrderItemsForEdit,
  readShippingAddressValue,
} from './edit-order-payload';

describe('edit order prefill helpers', () => {
  it('reads legacy and current shipping address shapes', () => {
    expect(
      readShippingAddressValue({ address_line1: 'Legacy street' }, 'address')
    ).toBe('Legacy street');
    expect(readShippingAddressValue({ city: 'Ikeja' }, 'city')).toBe('Ikeja');
  });

  it('maps saved order item snapshots back into editable order items', () => {
    expect(
      mapOrderItemsForEdit([
        {
          id: 'item-1',
          item_description: 'Open box',
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 2,
          variant_attributes: { color: 'Black' },
          variant_id: 'variant-1',
          variant_name: 'Black',
        },
      ])
    ).toEqual([
      {
        condition: undefined,
        details: 'Open box',
        id: 'item-1',
        image_url: undefined,
        is_custom: false,
        name: 'Samsung',
        price: 1200,
        product_id: 'product-1',
        product_match_status: 'linked',
        quantity: 2,
        variant_attributes: { color: 'Black' },
        variant_id: 'variant-1',
        variant_name: 'Black',
      },
    ]);
  });

  it('keeps product-less unreviewed snapshots distinct from custom items', () => {
    expect(
      mapOrderItemsForEdit([
        {
          id: 'item-2',
          item_description: 'Imported line',
          name: 'Imported Samsung',
          price: 1200,
          product_id: null,
          product_match_status: 'unreviewed',
          quantity: 1,
          variant_attributes: { color: 'Silver', storage: '256GB' },
          variant_id: null,
          variant_name: 'Silver / 256GB',
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: 'item-2',
        is_custom: false,
        product_id: null,
        product_match_status: 'unreviewed',
        variant_attributes: { color: 'Silver', storage: '256GB' },
        variant_id: null,
        variant_name: 'Silver / 256GB',
      }),
    ]);
  });

  it('generates distinct fallback ids for duplicate saved snapshots', () => {
    expect(
      mapOrderItemsForEdit([
        {
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 1,
          variant_id: 'variant-1',
        },
        {
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 1,
          variant_id: 'variant-1',
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: 'product-1::variant-1::0',
        product_id: 'product-1',
        variant_id: 'variant-1',
      }),
      expect.objectContaining({
        id: 'product-1::variant-1::1',
        product_id: 'product-1',
        variant_id: 'variant-1',
      }),
    ]);
  });

  it('skips malformed saved order item snapshots', () => {
    expect(mapOrderItemsForEdit([null, 'bad item'])).toEqual([]);
  });
});
