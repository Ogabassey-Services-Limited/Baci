import { describe, expect, it } from 'vitest';
import { buildCheckoutOrderItems } from './build-order-items';

describe('buildCheckoutOrderItems', () => {
  it('preserves selected variant details in the order payload', () => {
    const items = buildCheckoutOrderItems([
      {
        id: 'prod_1',
        name: 'Galaxy S22 Ultra',
        quantity: 1,
        price: 500000,
        negotiatedPrice: 480000,
        variantId: 'variant_256',
        variantAttributes: {
          color: 'Black',
          storage: '256GB',
        },
        hasAssurance: true,
        assuranceRate: 0.05,
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        product_id: 'prod_1',
        price: 480000,
        value: 480000,
        variantId: 'variant_256',
        variantAttributes: {
          color: 'Black',
          storage: '256GB',
        },
        has_assurance: true,
        assurance_fee: 24000,
      }),
    ]);
  });

  it('hydrates color and storage from cart selections when variant attributes are incomplete', () => {
    const items = buildCheckoutOrderItems([
      {
        id: 'prod_2',
        name: 'Samsung Galaxy S22 Ultra',
        quantity: 1,
        price: 500000,
        selectedColor: 'Phantom Black',
        selectedStorage: '128GB',
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        product_id: 'prod_2',
        variantAttributes: {
          color: 'Phantom Black',
          storage: '128GB',
        },
      }),
    ]);
  });
});
