import { describe, expect, it } from 'vitest';

import type {
  PaidOrder,
  PaidTransaction,
} from '@/lib/payments/apply-paid-order-side-effects';
import type { RichOrder } from '@/scripts/reconcile-paystack-dva-executors';
import {
  computeExitCode,
  FINANCIAL_INCONSISTENT_ERROR,
  isToleratedPhaseAFailure,
  normalizePaidOrder,
  normalizePaidTransaction,
  PHASE_A_PENDING_STEPS,
} from '@/scripts/reconcile-paystack-dva-internals';

describe('isToleratedPhaseAFailure', () => {
  it.each([
    ['firs_invoice', FINANCIAL_INCONSISTENT_ERROR, true],
    ['loyalty_points', FINANCIAL_INCONSISTENT_ERROR, true],
    ['firs_invoice', 'firs_api_timeout', false],
    ['loyalty_points', 'something_else', false],
    ['merchant_settlement', FINANCIAL_INCONSISTENT_ERROR, false],
    ['merchant_settlement', 'rpc_timeout', false],
    ['paid_email', FINANCIAL_INCONSISTENT_ERROR, false],
    ['ad_tracking_conversion', 'whatever', false],
  ] as const)(
    'step=%s error=%s tolerated=%s (Δ-91 && allowlist)',
    (step, error, expected) => {
      expect(isToleratedPhaseAFailure({ step, error })).toBe(expected);
    }
  );
});

describe('PHASE_A_PENDING_STEPS', () => {
  it('contains exactly firs_invoice and loyalty_points (Δ-31 wait list)', () => {
    expect(PHASE_A_PENDING_STEPS.has('firs_invoice')).toBe(true);
    expect(PHASE_A_PENDING_STEPS.has('loyalty_points')).toBe(true);
    expect(PHASE_A_PENDING_STEPS.size).toBe(2);
  });
});

describe('FINANCIAL_INCONSISTENT_ERROR', () => {
  it('matches the helper exact string (Δ-51 invariant)', () => {
    expect(FINANCIAL_INCONSISTENT_ERROR).toBe('financial_totals_inconsistent');
  });
});

describe('computeExitCode', () => {
  it('returns 0 when nothing failed', () => {
    expect(
      computeExitCode({
        ranSteps: ['paid_email', 'merchant_settlement'],
        skippedSteps: [],
        failedSteps: [],
        concurrentTakeoverSteps: [],
      })
    ).toBe(0);
  });

  it('returns 0 when only the Δ-31 firs/loyalty + financial_totals_inconsistent pair failed', () => {
    expect(
      computeExitCode({
        ranSteps: ['paid_email', 'merchant_settlement', 'ad_tracking_conversion'],
        skippedSteps: [],
        failedSteps: [
          { step: 'firs_invoice', error: FINANCIAL_INCONSISTENT_ERROR },
          { step: 'loyalty_points', error: FINANCIAL_INCONSISTENT_ERROR },
        ],
        concurrentTakeoverSteps: [],
      })
    ).toBe(0);
  });

  it('returns 1 when a non-firs/loyalty step fails with financial_totals_inconsistent (Δ-91)', () => {
    expect(
      computeExitCode({
        ranSteps: ['paid_email'],
        skippedSteps: [],
        failedSteps: [
          { step: 'merchant_settlement', error: FINANCIAL_INCONSISTENT_ERROR },
        ],
        concurrentTakeoverSteps: [],
      })
    ).toBe(1);
  });

  it('returns 1 when firs/loyalty fails with a non-financial error (Δ-91)', () => {
    expect(
      computeExitCode({
        ranSteps: ['paid_email', 'merchant_settlement'],
        skippedSteps: [],
        failedSteps: [{ step: 'firs_invoice', error: 'firs_api_timeout' }],
        concurrentTakeoverSteps: [],
      })
    ).toBe(1);
  });
});

describe('normalizePaidOrder', () => {
  const base: RichOrder = {
    id: 'order-1',
    merchant_id: 'merchant-1',
    payment_status: 'paid',
    tax_basis: 'exclusive',
    subtotal: 1000,
    shipping_fee: 50,
    gift_wrapping_fee: 0,
    tax_amount: 75,
    discount_amount: 0,
    total: 1125,
  };

  it('passes through known tax_basis values', () => {
    expect(normalizePaidOrder(base).tax_basis).toBe('exclusive');
    expect(normalizePaidOrder({ ...base, tax_basis: 'inclusive' }).tax_basis).toBe(
      'inclusive'
    );
  });

  it('normalizes unknown/missing tax_basis to null', () => {
    expect(normalizePaidOrder({ ...base, tax_basis: null }).tax_basis).toBeNull();
    expect(
      normalizePaidOrder({ ...base, tax_basis: 'nonsense' as unknown as null })
        .tax_basis
    ).toBeNull();
  });

  it('coerces numeric fields and defaults non-finite to 0', () => {
    const out: PaidOrder = normalizePaidOrder({
      ...base,
      subtotal: '1000' as unknown as number,
      shipping_fee: Number.NaN as unknown as number,
      total: '1125.5' as unknown as number,
    });
    expect(out.subtotal).toBe(1000);
    expect(out.shipping_fee).toBe(0);
    expect(out.total).toBe(1125.5);
  });
});

describe('normalizePaidTransaction', () => {
  it('passes through valid fields and preserves string-vs-number amount', () => {
    const txn: PaidTransaction = normalizePaidTransaction({
      id: 'txn-1',
      order_id: 'order-1',
      merchant_id: 'merchant-1',
      gateway_reference: 'BAC-abc',
      amount: '835000',
    });
    expect(txn.id).toBe('txn-1');
    expect(txn.gateway_reference).toBe('BAC-abc');
    expect(txn.amount).toBe('835000');
  });

  it('normalizes non-string gateway_reference to null', () => {
    expect(
      normalizePaidTransaction({
        id: 't',
        order_id: 'o',
        merchant_id: 'm',
        gateway_reference: 12345,
        amount: 100,
      }).gateway_reference
    ).toBeNull();
  });

  it('normalizes non-number/string amount to null', () => {
    expect(
      normalizePaidTransaction({
        id: 't',
        order_id: 'o',
        merchant_id: 'm',
        gateway_reference: 'BAC-x',
        amount: { v: 1 },
      }).amount
    ).toBeNull();
  });
});
