import { describe, expect, it } from 'vitest';
import {
  readOptionalShippingFee,
  readReuseQuoteValidationContext,
} from './quote-validation-context';

describe('readReuseQuoteValidationContext', () => {
  it('preserves product shipping metadata from reusable order quote rows', () => {
    expect(
      readReuseQuoteValidationContext({
        selected_quote_id: 'quote-1',
        shipping_address: {
          address: '123 Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
        },
        shipping_fee: '10000',
        shipping_provider: 'GIGL',
        order_items: [
          {
            name: 'Phone',
            quantity: 1,
            product: {
              weight_value: '500',
              weight_unit: 'g',
              dimensions: { length: 4, width: 3, height: 2, unit: 'in' },
              commodity_code: '851712',
            },
          },
        ],
      })
    ).toEqual({
      selected_quote_id: 'quote-1',
      shipping_address: {
        address: '123 Queen Street West',
        city: 'Toronto',
        country: undefined,
        countryCode: undefined,
        postalCode: undefined,
        state: 'Ontario',
      },
      shipping_fee: '10000',
      shipping_provider: 'GIGL',
      order_items: [
        {
          name: 'Phone',
          quantity: 1,
          weight: 0.5,
          hsCode: '851712',
          length: 10.16,
          width: 7.62,
          height: 5.08,
        },
      ],
    });
  });
});

describe('readOptionalShippingFee', () => {
  it('keeps absent reusable order shipping fees non-comparable', () => {
    expect(Number.isNaN(readOptionalShippingFee(null))).toBe(true);
  });
});
