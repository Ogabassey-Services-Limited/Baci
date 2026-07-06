/**
 * Friendly, shopper-facing copy for the machine error codes the
 * `create_storefront_order` / `create_storefront_order_with_quiz_voucher`
 * RPCs surface. The orders API returns the raw code in `details`, so without
 * this map a server-rejected quiz voucher shows a bare code like
 * `quiz_voucher_award_not_approved` in the checkout toast.
 */
export const ORDER_CREATE_VALIDATION_MESSAGES: Record<string, string> = {
  quiz_voucher_award_invalid_type:
    "This prize can't be redeemed at checkout. Please contact support.",
  quiz_voucher_award_not_approved:
    "This prize isn't available to redeem yet. Please contact support.",
  quiz_voucher_award_not_found:
    'This prize voucher has already been used or is no longer valid.',
  quiz_voucher_invalid:
    'This prize voucher has already been used or is no longer valid.',
  quiz_voucher_order_item_not_found:
    'This prize voucher has already been used or is no longer valid.',
  quiz_voucher_token_expired: 'Your quiz prize voucher has expired.',
  quiz_voucher_user_required:
    'Please sign in to redeem your quiz prize voucher.',
};

const DEFAULT_ORDER_CREATE_ERROR = 'Failed to create order';

// Quiz-voucher rejection codes whose cart line should be pruned on failure.
// `quiz_voucher_user_required` is intentionally excluded: the voucher is still
// redeemable once the shopper signs in, so pruning it would lose a valid prize.
const QUIZ_VOUCHER_REJECTION_CODES = new Set([
  'quiz_voucher_award_invalid_type',
  'quiz_voucher_award_not_approved',
  'quiz_voucher_award_not_found',
  'quiz_voucher_invalid',
  'quiz_voucher_order_item_not_found',
  'quiz_voucher_token_expired',
]);

interface OrderCreateErrorData {
  error?: unknown;
  details?: unknown;
}

/** The most specific code the orders API returned (`details`, else `error`). */
export function getOrderCreateErrorCode(
  errorData: OrderCreateErrorData
): string | null {
  const details =
    typeof errorData.details === 'string' ? errorData.details : null;
  const error = typeof errorData.error === 'string' ? errorData.error : null;
  return details ?? error;
}

/** True when the order was rejected because of an unredeemable quiz voucher. */
export function isQuizVoucherRejectionCode(code: string | null): boolean {
  return code !== null && QUIZ_VOUCHER_REJECTION_CODES.has(code);
}

/** Maps an orders-API error payload to actionable, shopper-facing copy. */
export function getCheckoutOrderErrorMessage(
  errorData: OrderCreateErrorData
): string {
  const code = getOrderCreateErrorCode(errorData);
  if (code && ORDER_CREATE_VALIDATION_MESSAGES[code]) {
    return ORDER_CREATE_VALIDATION_MESSAGES[code];
  }
  return code ?? DEFAULT_ORDER_CREATE_ERROR;
}
