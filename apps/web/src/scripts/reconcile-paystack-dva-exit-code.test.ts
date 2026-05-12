import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  verifyTransaction: vi.fn(),
  applyPaidOrderSideEffects: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: mocks.verifyTransaction,
}));
vi.mock('@/lib/payments/apply-paid-order-side-effects', () => ({
  applyPaidOrderSideEffects: mocks.applyPaidOrderSideEffects,
}));

import { runReconcilePaystackDvaCli } from '@/scripts/reconcile-paystack-dva';
import {
  createSupabaseMock,
  efosaArgs,
  verifySuccess,
} from '@/scripts/reconcile-paystack-dva-fixtures';

describe('runReconcilePaystackDvaCli — outbox failure surfaces in exit code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns non-zero when a non-Δ-31 step fails (paid_email, settlement, ad_tracking)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: ['paid_email'],
      skippedSteps: [],
      failedSteps: [{ step: 'merchant_settlement', error: 'rpc_timeout' }],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(1);
  });

  it('returns 0 when only Δ-31 firs/loyalty failures remain (expected for incident order)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: [
        'paid_email',
        'ad_tracking_conversion',
        'merchant_settlement',
      ],
      skippedSteps: [],
      failedSteps: [
        { step: 'firs_invoice', error: 'financial_totals_inconsistent' },
        { step: 'loyalty_points', error: 'financial_totals_inconsistent' },
      ],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(0);
  });

  // Δ-91 regression: pins the narrow allowlist. A previous `||` widened
  // the tolerated set to "ANY firs/loyalty failure OR ANY financial
  // failure" — a real settlement or email regression would have passed
  // through. The fix uses `&&` so only the (firs|loyalty) +
  // financial_totals_inconsistent pair is tolerated.
  it('returns 1 when firs_invoice fails with a non-financial error (Δ-91 widening regression)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: ['paid_email', 'ad_tracking_conversion', 'merchant_settlement'],
      skippedSteps: [],
      failedSteps: [{ step: 'firs_invoice', error: 'firs_api_timeout' }],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(1);
  });

  it('returns 1 when a non-firs/loyalty step fails with financial_totals_inconsistent (Δ-91 widening regression)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: ['paid_email', 'ad_tracking_conversion'],
      skippedSteps: [],
      failedSteps: [
        // Settlement with financial_totals_inconsistent must NOT be
        // tolerated — settlement is not on the Δ-31 wait list.
        {
          step: 'merchant_settlement',
          error: 'financial_totals_inconsistent',
        },
      ],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(1);
  });
});
