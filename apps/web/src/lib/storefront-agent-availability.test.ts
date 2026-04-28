import { describe, expect, it } from 'vitest';
import {
  coerceStorefrontManageStock,
  getStorefrontAgentAvailability,
  isUnmanagedStock,
} from '@/lib/storefront-agent-availability';

describe('storefront agent availability', () => {
  it('treats manage_stock=false as untracked and purchasable', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: false,
        stock: 0,
        stock_quantity: 0,
      })
    ).toMatchObject({
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock: 0,
    });
  });

  it('coerces nullish manage_stock to unmanaged storefront inventory', () => {
    expect(coerceStorefrontManageStock(null)).toBe(false);
    expect(coerceStorefrontManageStock(undefined)).toBe(false);
    expect(coerceStorefrontManageStock(false)).toBe(false);
    expect(coerceStorefrontManageStock(true)).toBe(true);
    expect(
      getStorefrontAgentAvailability({
        manage_stock: null,
        stock: 0,
        stock_quantity: 0,
      })
    ).toMatchObject({
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock: 0,
    });
  });

  it('treats managed zero stock as out of stock', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: true,
        stock: 0,
        stock_quantity: 0,
      })
    ).toMatchObject({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
    });
  });

  it('treats managed positive stock as in stock with a quantity', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: true,
        stock: 3,
        stock_quantity: 3,
      })
    ).toMatchObject({
      availability: 'in_stock',
      inventory_policy: 'tracked',
      is_purchasable: true,
      quantity_available: 3,
    });
  });

  it('infers untracked inventory from nullish manage_stock on storefront reads', () => {
    expect(isUnmanagedStock({ manage_stock: undefined })).toBe(true);
    expect(isUnmanagedStock({ manage_stock: null })).toBe(true);
  });

  it.each([
    {
      label: 'negative stock',
      product: { manage_stock: true, stock: -3, stock_quantity: -2 },
      quantity: 0,
      availability: 'out_of_stock',
    },
    {
      label: 'fractional stock quantity',
      product: { manage_stock: true, stock: 0, stock_quantity: 1.5 },
      quantity: 1,
      availability: 'in_stock',
    },
    {
      label: 'large stock quantity',
      product: { manage_stock: true, stock: 0, stock_quantity: 1_000_000 },
      quantity: 1_000_000,
      availability: 'in_stock',
    },
    {
      label: 'boundary zero',
      product: { manage_stock: true, stock: 0, stock_quantity: 0 },
      quantity: 0,
      availability: 'out_of_stock',
    },
    {
      label: 'boundary one',
      product: { manage_stock: true, stock: 1, stock_quantity: 1 },
      quantity: 1,
      availability: 'in_stock',
    },
    {
      label: 'conflicting stock and stock_quantity',
      product: { manage_stock: true, stock: 5, stock_quantity: 3 },
      quantity: 3,
      availability: 'in_stock',
    },
  ] as const)('sanitizes managed $label', ({
    product,
    quantity,
    availability,
  }) => {
    expect(getStorefrontAgentAvailability(product)).toMatchObject({
      availability,
      inventory_policy: 'tracked',
      is_purchasable: quantity > 0,
      quantity_available: quantity,
      stock: quantity,
    });
  });

  it('treats missing stock fields as tracked out of stock', () => {
    expect(
      getStorefrontAgentAvailability({ manage_stock: true })
    ).toMatchObject({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
      stock: 0,
    });
  });

  it('does not treat malformed manage_stock values as unmanaged', () => {
    expect(
      isUnmanagedStock({ manage_stock: 'false' as unknown as boolean })
    ).toBe(false);
    expect(isUnmanagedStock({ manage_stock: 0 as unknown as boolean })).toBe(
      false
    );
  });
});
