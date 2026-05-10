// Δ-31 / Δ-32 / Δ-37 / Δ-38: shared "does this order's `total` match its
// component shape?" check. Used by the outbox helper to gate FIRS / loyalty
// (which both depend on a correct `total`), and later by Phase B4's review
// predicate. Tolerance is ₦1 to absorb rounding.

export type TaxBasis = 'exclusive' | 'inclusive' | null;

export type FinancialConsistencyInput = {
  tax_basis: TaxBasis;
  subtotal: number;
  shipping_fee: number;
  gift_wrapping_fee?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  total: number;
};

export type FinancialConsistencyResult =
  | { consistent: true }
  | {
      consistent: false;
      reason: 'tax_basis_unclassified' | 'financial_totals_inconsistent';
      detail: {
        tax_basis: TaxBasis;
        subtotal: number;
        shipping_fee: number;
        gift_wrapping_fee: number;
        tax_amount: number;
        discount_amount: number;
        total: number;
        expected: number;
      };
    };

const TOLERANCE_NGN = 1;

function n(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function financialConsistency(
  input: FinancialConsistencyInput
): FinancialConsistencyResult {
  const subtotal = n(input.subtotal);
  const shippingFee = n(input.shipping_fee);
  const giftWrappingFee = n(input.gift_wrapping_fee);
  const taxAmount = n(input.tax_amount);
  const discountAmount = n(input.discount_amount);
  const total = n(input.total);

  // tax_basis NULL = A0 backfill couldn't classify; the order is in
  // reconciliation_review (issue_type='tax_basis_unclassified'). Treat as
  // inconsistent so dependent side effects defer until ops resolves it.
  if (input.tax_basis === null) {
    return {
      consistent: false,
      reason: 'tax_basis_unclassified',
      detail: {
        tax_basis: null,
        subtotal,
        shipping_fee: shippingFee,
        gift_wrapping_fee: giftWrappingFee,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        expected: 0,
      },
    };
  }

  const expected =
    input.tax_basis === 'exclusive'
      ? subtotal + shippingFee + giftWrappingFee + taxAmount - discountAmount
      : subtotal + shippingFee + giftWrappingFee - discountAmount;

  if (Math.abs(total - expected) <= TOLERANCE_NGN) {
    return { consistent: true };
  }

  return {
    consistent: false,
    reason: 'financial_totals_inconsistent',
    detail: {
      tax_basis: input.tax_basis,
      subtotal,
      shipping_fee: shippingFee,
      gift_wrapping_fee: giftWrappingFee,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      expected,
    },
  };
}
