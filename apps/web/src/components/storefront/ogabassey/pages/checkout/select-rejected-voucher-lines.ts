import {
  getOrderCreateErrorCode,
  isQuizVoucherRejectionCode,
} from './checkout-order-error-message';

/** Minimal shape of a cart line needed to decide voucher pruning. */
export interface VoucherCartLine {
  quizVoucherToken?: string | null;
  quizAwardId?: string | null;
}

/** The subset of the `/api/orders` error payload used for pruning decisions. */
export interface RejectedVoucherErrorData {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  rejectedVoucherToken?: unknown;
}

/**
 * Decide which voucher-backed cart lines to prune after `/api/orders` rejects
 * an order.
 *
 * A rejected voucher would otherwise stick in the cart at ₦0 and re-fail every
 * future checkout, so unredeemable voucher lines are pruned. But when a cart
 * holds MULTIPLE prize vouchers and only one is expired/voided, pruning every
 * voucher line silently discards the shopper's still-valid prizes.
 *
 * The orders route identifies the specific failed line via `rejectedVoucherToken`
 * (the exact token it rejected). When present, only that line is pruned. When
 * the server did not identify one, pruning is limited to the unambiguous
 * single-voucher case so a multi-voucher cart never loses a valid prize.
 */
export function selectRejectedVoucherLines<T extends VoucherCartLine>(
  cart: readonly T[],
  errorData: RejectedVoucherErrorData
): T[] {
  const code = getOrderCreateErrorCode(errorData);
  if (!isQuizVoucherRejectionCode(code)) {
    return [];
  }

  const voucherLines = cart.filter(
    (line) => line.quizVoucherToken || line.quizAwardId
  );

  const rejectedVoucherToken =
    typeof errorData.rejectedVoucherToken === 'string'
      ? errorData.rejectedVoucherToken
      : null;

  if (rejectedVoucherToken) {
    return voucherLines.filter(
      (line) => line.quizVoucherToken === rejectedVoucherToken
    );
  }

  // No specific line identified: only prune when there is exactly one voucher
  // line so a valid prize in a multi-voucher cart is never discarded.
  return voucherLines.length === 1 ? [...voucherLines] : [];
}
