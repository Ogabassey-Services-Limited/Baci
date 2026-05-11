// Internal helpers for `reconcile-paystack-dva.ts`. Extracted so the
// orchestration entry stays under the 300-line per-file cap from
// CLAUDE.md. Importers should treat these as script-internal.

import type {
  ApplyPaidOrderSideEffectsResult,
  PaidOrder,
  PaidTransaction,
  SideEffectStep,
} from '@/lib/payments/apply-paid-order-side-effects';
import type { RichOrder } from '@/scripts/reconcile-paystack-dva-executors';

// Δ-31 partial-failure error string (matches helper exactly per Δ-51).
// A2 treats only this exact error on the Phase-A-pending steps as a
// non-blocking outcome — anything else exits non-zero.
export const FINANCIAL_INCONSISTENT_ERROR = 'financial_totals_inconsistent';

// firs_invoice + loyalty_points are wired in B3.5; in Phase A their
// failures with `financial_totals_inconsistent` are EXPECTED, not
// script-level errors. Replay after B3.5 ships picks them up.
export const PHASE_A_PENDING_STEPS: ReadonlySet<SideEffectStep> = new Set([
  'firs_invoice',
  'loyalty_points',
]);

// Phase A's only tolerated failure is the (firs_invoice|loyalty_points)
// + 'financial_totals_inconsistent' pair. Anything else must exit
// non-zero. Using `&&` here pins the narrow allowlist; an earlier `||`
// widened it to "ANY firs/loyalty failure OR ANY financial_totals_
// inconsistent" which let real bugs pass through silently (Δ-91).
export function isToleratedPhaseAFailure(failure: {
  step: SideEffectStep;
  error: string;
}): boolean {
  return (
    PHASE_A_PENDING_STEPS.has(failure.step) &&
    failure.error === FINANCIAL_INCONSISTENT_ERROR
  );
}

export function computeExitCode(
  result: ApplyPaidOrderSideEffectsResult
): number {
  const blockingFailures = result.failedSteps.filter(
    (f) => !isToleratedPhaseAFailure(f)
  );
  return blockingFailures.length > 0 ? 1 : 0;
}

export function normalizePaidOrder(row: RichOrder): PaidOrder {
  const taxBasisRaw = row.tax_basis;
  const taxBasis: 'exclusive' | 'inclusive' | null =
    taxBasisRaw === 'exclusive' || taxBasisRaw === 'inclusive'
      ? taxBasisRaw
      : null;
  return {
    id: row.id,
    merchant_id: row.merchant_id,
    payment_status: row.payment_status,
    tax_basis: taxBasis,
    subtotal: Number(row.subtotal) || 0,
    shipping_fee: Number(row.shipping_fee) || 0,
    gift_wrapping_fee: Number(row.gift_wrapping_fee) || 0,
    tax_amount: Number(row.tax_amount) || 0,
    discount_amount: Number(row.discount_amount) || 0,
    total: Number(row.total) || 0,
  };
}

export function normalizePaidTransaction(
  row: Record<string, unknown>
): PaidTransaction {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    merchant_id: String(row.merchant_id),
    gateway_reference:
      typeof row.gateway_reference === 'string' ? row.gateway_reference : null,
    amount:
      typeof row.amount === 'number' || typeof row.amount === 'string'
        ? row.amount
        : null,
  };
}
