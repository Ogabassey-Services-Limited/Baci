import { describe, expect, it } from 'vitest';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';

describe('extractVerifiedGatewayFeeNgn', () => {
  // Δ-0b: webhook/route.ts:1698 used `transaction.gateway_fee` which doesn't
  // exist on the column (Δ-0a) — silently 0. The verified Paystack response
  // is the only honest source. `fees` is in kobo, divide by 100 for NGN.
  describe('paystack', () => {
    it('returns the verified fee from the Paystack response in NGN', () => {
      expect(
        extractVerifiedGatewayFeeNgn('paystack', { fees: 12_525 })
      ).toBeCloseTo(125.25, 2);
    });

    it('returns 0 when fees is missing', () => {
      expect(extractVerifiedGatewayFeeNgn('paystack', {})).toBe(0);
    });

    it('returns 0 when fees is non-numeric or non-finite', () => {
      expect(extractVerifiedGatewayFeeNgn('paystack', { fees: 'oops' })).toBe(
        0
      );
      expect(
        extractVerifiedGatewayFeeNgn('paystack', { fees: Number.NaN })
      ).toBe(0);
      expect(extractVerifiedGatewayFeeNgn('paystack', null)).toBe(0);
      expect(extractVerifiedGatewayFeeNgn('paystack', undefined)).toBe(0);
    });

    it('returns 0 when fees is negative (review feedback: would over-credit merchant)', () => {
      // A negative fee subtracted from gross would inflate the net amount
      // credited to the merchant wallet. Treat as missing → 0 so settlement
      // calc falls back to a safe baseline.
      expect(extractVerifiedGatewayFeeNgn('paystack', { fees: -100 })).toBe(0);
      expect(extractVerifiedGatewayFeeNgn('paystack', { fees: -0.01 })).toBe(0);
    });
  });

  describe('korapay', () => {
    // Korapay's payment-verification response (lib/korapay.ts:79) has no
    // fee field. The PayoutResponseSchema's `fee` is for outbound payouts,
    // not inbound payments. Return 0 honestly rather than reading a column
    // that does not exist.
    it('returns 0 because verify-payment response has no fee field', () => {
      expect(extractVerifiedGatewayFeeNgn('korapay', { fee: 50 })).toBe(0);
      expect(extractVerifiedGatewayFeeNgn('korapay', {})).toBe(0);
    });
  });

  describe('other gateways', () => {
    it('returns 0 for unknown gateways', () => {
      expect(
        extractVerifiedGatewayFeeNgn('unknown' as never, { fees: 1000 })
      ).toBe(0);
    });
  });
});
