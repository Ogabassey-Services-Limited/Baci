import { describe, expect, it } from 'vitest';
import {
  computeEligibleLineDiscount,
  type NegotiationLineInput,
} from './eligible-line-discount';

const line = (
  over: Partial<NegotiationLineInput> = {}
): NegotiationLineInput => ({
  catalogUnitPrice: 1000,
  clientUnitPrice: 1000,
  quantity: 1,
  negotiable: true,
  vatCategoryCode: 'S',
  vatRate: 7.5,
  ...over,
});

describe('computeEligibleLineDiscount', () => {
  it('grosses up a within-floor negotiable discount by line VAT', () => {
    // catalog 1000, client 980 → reduction 20 = 2% floor; +7.5% VAT = 21.5
    expect(
      computeEligibleLineDiscount([line({ clientUnitPrice: 980 })])
    ).toEqual({
      totalDiscount: 21.5,
      rejectionCode: null,
    });
  });

  it('rejects a negotiable line priced more than 2% below catalog', () => {
    // client 950 → reduction 50 > 2% floor (20) → reject the order
    expect(
      computeEligibleLineDiscount([line({ clientUnitPrice: 950 })])
    ).toEqual({
      totalDiscount: 0,
      rejectionCode: 'negotiated_price_below_floor',
    });
  });

  it('rejects a non-negotiable line priced below catalog', () => {
    expect(
      computeEligibleLineDiscount([
        line({
          negotiable: false,
          catalogUnitPrice: 500,
          clientUnitPrice: 480,
        }),
      ])
    ).toEqual({
      totalDiscount: 0,
      rejectionCode: 'non_negotiable_line_discounted',
    });
  });

  it('allows a non-negotiable line at catalog price', () => {
    expect(
      computeEligibleLineDiscount([
        line({
          negotiable: false,
          catalogUnitPrice: 500,
          clientUnitPrice: 500,
        }),
      ])
    ).toEqual({ totalDiscount: 0, rejectionCode: null });
  });

  it('sums per-line discounts in a mixed cart, leaving the non-negotiable line at catalog', () => {
    expect(
      computeEligibleLineDiscount([
        line({ clientUnitPrice: 980 }), // MacBook negotiable, at floor → 21.5
        line({
          negotiable: false,
          catalogUnitPrice: 500,
          clientUnitPrice: 500,
        }), // Tecno at catalog
      ])
    ).toEqual({ totalDiscount: 21.5, rejectionCode: null });
  });

  it('does not gross up VAT for zero-rated lines', () => {
    // category 'Z' → rate 0; reduction 20 = floor 2%*1000 → discount 20
    expect(
      computeEligibleLineDiscount([
        line({ clientUnitPrice: 980, vatCategoryCode: 'Z' }),
      ])
    ).toEqual({ totalDiscount: 20, rejectionCode: null });
  });

  it('respects quantity in line totals and the floor', () => {
    // 2 × (1000 → 980): reduction 40 = 2% floor (2000) → +VAT 3 = 43
    expect(
      computeEligibleLineDiscount([line({ clientUnitPrice: 980, quantity: 2 })])
    ).toEqual({ totalDiscount: 43, rejectionCode: null });
  });
});
