import { describe, expect, it } from 'vitest';
import { toInternationalShipmentItemsFromOrder } from './international-shipment-items';

describe('toInternationalShipmentItemsFromOrder HS code validation', () => {
  it('rejects saved quotes when the current product HS code changed', () => {
    expect(() =>
      toInternationalShipmentItemsFromOrder(
        [
          {
            name: 'Phone',
            quantity: 1,
            price: 100_000,
            product: {
              weight_value: 1,
              weight_unit: 'kg',
              commodity_code: '851713',
            },
          },
        ],
        [
          {
            name: 'Phone',
            quantity: 1,
            weight: 1,
            value: 85_000,
            hsCode: '851712',
          },
        ]
      )
    ).toThrow('no longer matches the current product shipping details');
  });
});
