/**
 * Friendly, shopper-facing copy for the machine error codes the
 * `create_storefront_order` / `create_storefront_order_with_quiz_voucher`
 * RPCs surface. The orders API returns the raw code in `details`, so without
 * this map a server-rejected quiz voucher shows a bare code like
 * `quiz_voucher_award_not_approved` in the checkout toast.
 */
// Keys are the lowercased error identifier. The orders API surfaces RPC-level
// rejections in `details` (already lowercase, e.g. quiz_voucher_invalid) and
// pre-RPC rejections in `code` (uppercase, e.g. QUIZ_VOUCHER_TOKEN_EXPIRED);
// lookups lowercase the code so both shapes hit these entries.
export const ORDER_CREATE_VALIDATION_MESSAGES: Record<string, string> = {
  quiz_voucher_auth_required:
    'Please sign in to redeem your quiz prize voucher.',
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
  quiz_voucher_quantity_invalid:
    'A prize voucher must be redeemed on its own. Remove the other items or the voucher and try again.',
  quiz_voucher_token_config_missing:
    'Prize redemption is temporarily unavailable. Please try again shortly.',
  quiz_voucher_token_expired: 'Your quiz prize voucher has expired.',
  quiz_voucher_token_invalid:
    'This prize voucher has already been used or is no longer valid.',
  quiz_voucher_user_required:
    'Please sign in to redeem your quiz prize voucher.',
};

const DEFAULT_ORDER_CREATE_ERROR = 'Failed to create order';

// Quiz-voucher rejection codes whose cart line should be pruned on failure.
// Excluded on purpose: auth-required (voucher still valid once signed in),
// quantity-invalid (fixable by adjusting the cart), and config-missing
// (transient server issue) — pruning those would discard a valid prize.
const QUIZ_VOUCHER_REJECTION_CODES = new Set([
  'quiz_voucher_award_invalid_type',
  'quiz_voucher_award_not_approved',
  'quiz_voucher_award_not_found',
  'quiz_voucher_invalid',
  'quiz_voucher_order_item_not_found',
  'quiz_voucher_token_expired',
  'quiz_voucher_token_invalid',
]);

interface OrderCreateErrorData {
  error?: unknown;
  details?: unknown;
  code?: unknown;
}

/**
 * The most specific error identifier the orders API returned. RPC-level
 * rejections arrive in `details`; pre-RPC rejections (expired/invalid/auth)
 * arrive in `code` with no `details`, so fall back to it before the human
 * `error` string.
 */
export function getOrderCreateErrorCode(
  errorData: OrderCreateErrorData
): string | null {
  const details =
    typeof errorData.details === 'string' ? errorData.details : null;
  const code = typeof errorData.code === 'string' ? errorData.code : null;
  const error = typeof errorData.error === 'string' ? errorData.error : null;
  return details ?? code ?? error;
}

/** True when the order was rejected because of an unredeemable quiz voucher. */
export function isQuizVoucherRejectionCode(code: string | null): boolean {
  return code !== null && QUIZ_VOUCHER_REJECTION_CODES.has(code.toLowerCase());
}

/** Maps an orders-API error payload to actionable, shopper-facing copy. */
export function getCheckoutOrderErrorMessage(
  errorData: OrderCreateErrorData
): string {
  const code = getOrderCreateErrorCode(errorData);
  const mapped = code
    ? ORDER_CREATE_VALIDATION_MESSAGES[code.toLowerCase()]
    : undefined;
  if (mapped) {
    return mapped;
  }
  return code ?? DEFAULT_ORDER_CREATE_ERROR;
}
