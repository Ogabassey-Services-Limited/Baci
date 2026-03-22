import { describe, expect, it } from 'vitest';
import {
  asNumber,
  asString,
  buildCustomerAddress,
  buildOrderItems,
  normalizeShippingAddress,
} from '@/lib/storefront-account-document-values';

describe('storefront account document values', () => {
  it('normalizes shipping address records and strings', () => {
    expect(normalizeShippingAddress('12 Allen Avenue')).toEqual({
      address_line1: '12 Allen Avenue',
    });
    expect(normalizeShippingAddress('')).toBeNull();
    expect(normalizeShippingAddress(undefined)).toBeNull();

    expect(
      normalizeShippingAddress({
        street: '12 Allen Avenue',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'NG',
      })
    ).toEqual({
      address_line1: '12 Allen Avenue',
      address_line2: '',
      city: 'Lagos',
      state: 'Lagos',
      postal_code: '100001',
      country: 'NG',
    });
  });

  it('coerces numeric values with asNumber', () => {
    expect(asNumber('1200')).toBe(1200);
    expect(asNumber(null)).toBe(0);
    expect(asNumber(undefined)).toBe(0);
  });

  it('coerces non-string values with asString', () => {
    expect(asString(42)).toBe('');
    expect(asString(undefined)).toBe('');
  });

  it('builds customer addresses with and without address line 2', () => {
    expect(
      buildCustomerAddress({
        address_line1: '12 Allen Avenue',
        address_line2: 'Suite 4',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'NG',
      })
    ).toEqual({
      street: '12 Allen Avenue, Suite 4',
      city: 'Lagos',
      state: 'Lagos',
      postal_code: '100001',
      country: 'NG',
    });
    expect(
      buildCustomerAddress({
        address_line1: '12 Allen Avenue',
        address_line2: '',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'NG',
      })
    ).toEqual({
      street: '12 Allen Avenue',
      city: 'Lagos',
      state: 'Lagos',
      postal_code: '100001',
      country: 'NG',
    });
  });

  it('normalizes order items for document builders', () => {
    expect(buildOrderItems([])).toEqual([]);
    expect(
      buildOrderItems([
        {
          id: 'item-1',
          product_id: null,
          name: 'iPhone 16',
          quantity: 2,
          price: 1000,
        },
        {
          id: 'item-2',
          product_id: 'prod-2',
          name: 'MacBook Air',
          quantity: null,
          price: '500' as never,
        },
      ])
    ).toEqual([
      {
        id: 'item-1',
        product_id: '',
        name: 'iPhone 16',
        product_name: 'iPhone 16',
        quantity: 2,
        price: 1000,
      },
      {
        id: 'item-2',
        product_id: 'prod-2',
        name: 'MacBook Air',
        product_name: 'MacBook Air',
        quantity: 0,
        price: 500,
      },
    ]);
  });
});
