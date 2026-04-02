import {
  calculateOrderTotals,
  canFallbackToLocalOrderTotals,
  normalizeRemoteOrderTotals,
} from './commerce';

describe('commerce order totals', () => {
  it('includes assurance in normalized order totals', () => {
    expect(
      normalizeRemoteOrderTotals(
        {
          subtotal: 1000,
          shippingFee: 500,
          taxRate: 0.075,
          assuranceFee: 100,
        },
        {
          taxAmount: 75,
          total: 1575,
        }
      )
    ).toEqual({
      taxAmount: 75,
      total: 1675,
    });
  });

  it('computes local fallback totals for order calculations', () => {
    expect(
      calculateOrderTotals({
        subtotal: 2500,
        shippingFee: 750,
        taxRate: 0.075,
        assuranceFee: 125,
      })
    ).toEqual({
      taxAmount: 187.5,
      total: 3562.5,
    });
  });

  it('rounds currency safely for floating-point edge cases', () => {
    expect(
      calculateOrderTotals({
        subtotal: 13.4,
        shippingFee: 0,
        taxRate: 0.075,
        assuranceFee: 0,
      })
    ).toEqual({
      taxAmount: 1.01,
      total: 14.41,
    });
  });

  it('recomputes total when the remote tax differs from local tax', () => {
    expect(
      normalizeRemoteOrderTotals(
        {
          subtotal: 1000,
          shippingFee: 500,
          taxRate: 0.05,
          assuranceFee: 100,
        },
        {
          taxAmount: 75,
        }
      )
    ).toEqual({
      taxAmount: 75,
      total: 1675,
    });
  });

  it('treats edge function transport failures as fallback-safe', () => {
    const error = Object.assign(
      new Error('Failed to send a request to the Edge Function'),
      {
        name: 'FunctionsFetchError',
      }
    );

    expect(canFallbackToLocalOrderTotals(error)).toBe(true);
  });
});
