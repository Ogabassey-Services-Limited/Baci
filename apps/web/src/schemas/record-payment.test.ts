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

  // Δ-36 (A3): mobile-admin sends `notes: ""` when the optional Notes
  // input is blank. Pre-A3 the schema's `.min(1)` rejected this as
  // 'Invalid request body'. Normalize blank/whitespace to undefined so
  // staff can record cash/POS payments without typing a note.
  it('normalizes blank notes to undefined', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'cash',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBeUndefined();
  });

  it('normalizes whitespace-only notes to undefined', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'cash',
      notes: '   ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBeUndefined();
  });

  it('normalizes blank reference to undefined', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'cash',
      reference: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reference).toBeUndefined();
  });

  it('normalizes whitespace-only reference to undefined', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'cash',
      reference: '   ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reference).toBeUndefined();
  });

  it('preserves non-blank notes after trimming', () => {
    const result = recordPaymentBodySchema.safeParse({
      amount: 5000,
      payment_method: 'cash',
      notes: '  Partial payment from staff till  ',
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.notes).toBe('Partial payment from staff till');
  });

  // Shared base so amount-focused tests only vary the amount field
  const basePayload = { payment_method: 'cash' };

  it('coerces string amount to number', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: '129026',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(129026);
  });

  it('rejects zero amount', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: -100,
    });

    expect(result.success).toBe(false);
  });

  it('rejects amount with more than 2 decimal places', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: 100.001,
    });

    expect(result.success).toBe(false);
  });

  it('accepts amount with up to 2 decimal places', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: 100.5,
    });

    expect(result.success).toBe(true);
  });

  it('accepts amount with exactly 2 decimal places', () => {
    const result = recordPaymentBodySchema.safeParse({
      ...basePayload,
      amount: 100.55,
    });

    expect(result.success).toBe(true);
  });
});
