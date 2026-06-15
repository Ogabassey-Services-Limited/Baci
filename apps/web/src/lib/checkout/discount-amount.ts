/**
 * Single source of truth for the storefront discount-code amount.
 *
 * The same whole-unit rounding is mirrored by the redemption RPC's
 * `v_expected` (Task 4), so the route's `p_discount_amount` and the DB's
 * re-derived amount agree and the wrapper's two-sided ±1 check passes.
 * Eligibility (`applies_to`) is NOT computed here — it is enforced
 * authoritatively in the order RPC against the created order's items.
 */
export interface DiscountCodeForAmount {
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  maximum_discount_amount: number | null;
}

export function computeDiscountAmountForSubtotal(
  code: DiscountCodeForAmount,
  subtotal: number
): number {
  let amount =
    code.discount_type === 'percentage'
      ? Math.round((subtotal * code.discount_value) / 100)
      : Math.round(code.discount_value);

  if (code.maximum_discount_amount != null) {
    amount = Math.min(amount, Math.round(code.maximum_discount_amount));
  }

  return Math.max(0, Math.min(amount, Math.round(subtotal)));
}
