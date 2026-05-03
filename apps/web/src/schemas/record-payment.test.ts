import { describe, expect, it } from 'vitest';
import { recordPaymentBodySchema } from './record-payment';

describe('recordPaymentBodySchema', () => {
  it('accepts a valid record-payment payload', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: '5000',
      payment_method: 'bank_transfer',
      reference: 'REF-123',
      notes: 'Manual payment',
    });

    expect(result.success).toBe(true);
  });

  it('rejects non-object payloads', () => {
    const result = recordPaymentBodySchema.safeParse(null);

    expect(result.success).toBe(false);
  });

  it('trims optional string fields', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: ' bank_transfer ',
      reference: ' REF-123 ',
      notes: ' Manual payment ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_method).toBe('bank_transfer');
      expect(result.data.reference).toBe('REF-123');
      expect(result.data.notes).toBe('Manual payment');
    }
  });

  it('accepts a payload without reference (reference is optional)', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'bank_transfer',
    });

    expect(result.success).toBe(true);
  });
});
