import { describe, expect, it } from 'vitest';
import { referenceSchema, verifyPaymentBodySchema } from './payments';

describe('payment schemas', () => {
  describe('referenceSchema', () => {
    it('accepts valid payment references', () => {
      const result = referenceSchema.safeParse('BAC-REF-123');

      expect(result.success).toBe(true);
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
});
