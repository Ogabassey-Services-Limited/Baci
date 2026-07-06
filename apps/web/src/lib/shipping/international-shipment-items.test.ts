import { describe, expect, it } from 'vitest';
import { toInternationalShipmentItemsFromOrder } from './international-shipment-items';

describe('toInternationalShipmentItemsFromOrder', () => {
  it('derives international package metadata from the linked product', () => {
    expect(
      toInternationalShipmentItemsFromOrder([
        {
          name: 'Phone',
          quantity: 2,
          price: '100000',
          product: {
            weight_value: '500',
            weight_unit: 'g',
            dimensions: { length: 4, width: 3, height: 2, unit: 'in' },
            commodity_code: '851712',
          },
        },
      ])
    ).toEqual([
      {
        name: 'Phone',
        description: 'Phone',
        quantity: 2,
        weight: 0.5,
        value: 100_000,
        hsCode: '851712',
        length: 10.16,
        width: 7.62,
        height: 5.08,
      },
    ]);
  });

  it('uses conservative order-derived defaults when product metadata is absent', () => {
    expect(
      toInternationalShipmentItemsFromOrder([
        {
          name: 'Custom item',
          quantity: null,
          price: 25_000,
          product: null,
        },
      ])
    ).toEqual([
      {
        name: 'Custom item',
        description: 'Custom item',
        quantity: 1,
        weight: 1,
        value: 25_000,
      },
    ]);
  });

  it('preserves the declared value from the matching quote item', () => {
    expect(
      toInternationalShipmentItemsFromOrder(
        [
          {
            name: 'Phone',
            quantity: 1,
            price: 100_000,
            product: {
              weight_value: 1,
              weight_unit: 'kg',
              commodity_code: '851712',
            },
          },
        ],
        [{ name: 'Phone', quantity: 1, weight: 1, value: 85_000 }]
      )
    ).toEqual([
      {
        name: 'Phone',
        description: 'Phone',
        quantity: 1,
        weight: 1,
        value: 85_000,
        hsCode: '851712',
      },
    ]);
  });

  it('rejects quote physical metadata that differs from product metadata', () => {
    expect(() =>
      toInternationalShipmentItemsFromOrder(
        [
          {
            name: 'Phone',
            quantity: 1,
            price: 100_000,
            product: {
              weight_value: 1.2,
              weight_unit: 'kg',
              dimensions: { length: 10, width: 8, height: 6, unit: 'cm' },
              commodity_code: '851712',
            },
          },
        ],
        [
          {
            name: 'Phone',
            quantity: 1,
            weight: 0.1,
            value: 85_000,
            hsCode: '851712',
          },
        ]
      )
    ).toThrow('no longer matches the current product shipping details');
  });

  it('normalizes millimeter dimensions and invalid prices safely', () => {
    expect(
      toInternationalShipmentItemsFromOrder([
        {
          name: 'Tablet',
          quantity: 1,
          price: 'not-a-number',
          product: {
            weight_value: 1,
            weight_unit: 'kg',
            dimensions: { length: 100, width: 80, height: 60, unit: 'mm' },
          },
        },
        {
          name: 'Laptop',
          quantity: 1,
          price: 250_000,
          product: {
            weight_value: 2,
            weight_unit: 'kg',
            dimensions: { length: 10, width: 8, height: 6 },
          },
        },
      ])
    ).toEqual([
      {
        name: 'Tablet',
        description: 'Tablet',
        quantity: 1,
        weight: 1,
        value: 0,
        length: 10,
        width: 8,
        height: 6,
      },
      {
        name: 'Laptop',
        description: 'Laptop',
        quantity: 1,
        weight: 2,
        value: 250_000,
        length: 10,
        width: 8,
        height: 6,
      },
    ]);
  });
});
