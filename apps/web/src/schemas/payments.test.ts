import { describe, expect, it } from 'vitest';
import {
  paystackZeroCandidateReviewGatewayResponseSchema,
  referenceSchema,
  verifyPaymentBodySchema,
} from './payments';

describe('payment schemas', () => {
  describe('referenceSchema', () => {
    it('accepts valid payment references', () => {
      const result = referenceSchema.safeParse('BAC-REF-123');

      expect(result.success).toBe(true);
    });

    it('trims surrounding whitespace before validating a reference', () => {
      const result = referenceSchema.safeParse('  BAC-REF-123  ');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('BAC-REF-123');
      }
    });

    it('accepts a 100-character payment reference', () => {
      const reference = 'A'.repeat(100);

      const result = referenceSchema.safeParse(reference);

      expect(result.success).toBe(true);
    });

    it('rejects empty payment references', () => {
      const result = referenceSchema.safeParse('');

      expect(result.success).toBe(false);
    });

    it('rejects whitespace-only payment references', () => {
      const result = referenceSchema.safeParse('   ');

      expect(result.success).toBe(false);
    });

    it('rejects references longer than 100 characters', () => {
      const reference = 'A'.repeat(101);

      const result = referenceSchema.safeParse(reference);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('too_big');
      }
    });

    it('accepts references with gateway-safe special characters', () => {
      const result = referenceSchema.safeParse('BAC-REF_123.456');

      expect(result.success).toBe(true);
    });
  });

  describe('verifyPaymentBodySchema', () => {
    it('accepts a valid reference body', () => {
      const result = verifyPaymentBodySchema.safeParse({
        reference: 'BAC-REF-123',
      });

      expect(result.success).toBe(true);
    });

    it('trims surrounding whitespace in the request body reference', () => {
      const result = verifyPaymentBodySchema.safeParse({
        reference: '  BAC-REF-123  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reference).toBe('BAC-REF-123');
      }
    });

    it('rejects an empty reference body', () => {
      const result = verifyPaymentBodySchema.safeParse({ reference: '' });

      expect(result.success).toBe(false);
    });

    it('rejects a missing reference field', () => {
      const result = verifyPaymentBodySchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only reference body', () => {
      const result = verifyPaymentBodySchema.safeParse({ reference: '   ' });

      expect(result.success).toBe(false);
    });

    it('rejects an overly long reference body', () => {
      const result = verifyPaymentBodySchema.safeParse({
        reference: 'A'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it('accepts a special-character reference body', () => {
      const result = verifyPaymentBodySchema.safeParse({
        reference: 'BAC-REF_123.456',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('paystackZeroCandidateReviewGatewayResponseSchema', () => {
    it('normalizes Paystack review metadata fields', () => {
      const result = paystackZeroCandidateReviewGatewayResponseSchema.safeParse(
        {
          channel: ' bank_transfer ',
          customer: {
            email: 'customer@example.com',
            customer_code: 'CUS_test',
          },
          paid_at: '2026-06-27T20:37:08.000Z',
          reference: 'PSK_REF',
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('bank_transfer');
        expect(result.data.customer.email).toBe('customer@example.com');
        expect(result.data.paid_at).toBe('2026-06-27T20:37:08.000Z');
      }
    });

    it('converts unusable optional metadata fields to null', () => {
      const result = paystackZeroCandidateReviewGatewayResponseSchema.safeParse(
        {
          channel: '   ',
          customer: 'not-an-object',
          paid_at: null,
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBeNull();
        expect(result.data.customer.email).toBeNull();
        expect(result.data.paid_at).toBeNull();
      }
    });
  });
});
