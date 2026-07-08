import { describe, expect, it } from 'vitest';
import type { PayPalCaptureResponse } from '@/lib/paypal';
import { validatePaypalCaptureSet } from './paypal-capture-validation';

type PurchaseUnits = PayPalCaptureResponse['purchase_units'];

function capture(value: string, status = 'COMPLETED', currency = 'USD') {
  return {
    id: `cap-${value}`,
    status,
    amount: { currency_code: currency, value },
  };
}

function units(captures: ReturnType<typeof capture>[][]): {
  purchase_units: PurchaseUnits;
} {
  return {
    purchase_units: captures.map((c) => ({
      payments: { captures: c },
    })) as PurchaseUnits,
  };
}

describe('validatePaypalCaptureSet', () => {
  it('accepts a single capture that matches the expected presentment', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('100.00')]]),
      100,
      'USD'
    );

    expect(result).toEqual({ ok: true, capturedTotal: 100, currency: 'USD' });
  });

  it('sums every capture across every purchase unit', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('60.00')], [capture('40.00')]]),
      100,
      'USD'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capturedTotal).toBe(100);
    }
  });

  it('rejects a partial capture set where one capture is not COMPLETED', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('60.00'), capture('40.00', 'PENDING')]]),
      100,
      'USD'
    );

    expect(result).toEqual({
      ok: false,
      reason: 'PayPal capture is not completed',
    });
  });

  it('rejects when the summed captures do not match the expected amount', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('60.00')]]),
      100,
      'USD'
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Payment amount mismatch with PayPal capture',
    });
  });

  it('rejects a currency mismatch', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('100.00', 'COMPLETED', 'EUR')]]),
      100,
      'USD'
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Payment currency mismatch with PayPal capture',
    });
  });

  it('rejects when there are no captures', () => {
    const result = validatePaypalCaptureSet(units([[]]), 100, 'USD');

    expect(result).toEqual({
      ok: false,
      reason: 'No captures found in PayPal response',
    });
  });

  it('rejects when presentment metadata is missing', () => {
    const result = validatePaypalCaptureSet(
      units([[capture('100.00')]]),
      Number.NaN,
      undefined
    );

    expect(result).toEqual({
      ok: false,
      reason: 'Missing PayPal presentment metadata',
    });
  });
});
