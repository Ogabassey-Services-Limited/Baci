import { Alert } from 'react-native';
import type { CartItem } from '@/stores/cart-store';
import { isQuizVoucherLine } from '@/lib/cart/quiz-voucher-line';

/** True when the cart carries a quiz prize (voucher) line. After the mixed-cart
 *  guard has run, a cart with a voucher line is voucher-ONLY. */
export function cartHasVoucherLine(items: CartItem[]): boolean {
  return items.some(isQuizVoucherLine);
}

/**
 * A quiz prize (voucher) line redeems as its own pre-reserved order; the server
 * ignores the other submitted items and the success path clears the whole cart,
 * so a cart that mixes a voucher line with paid lines would silently lose the
 * paid ones at checkout. This is the checkout-time safety net behind the
 * claim-time guard (a shopper can claim into an empty cart, then add a paid item
 * before checkout).
 *
 * Returns `true` (and alerts the shopper) when checkout must be blocked.
 */
export function blockIfMixedPrizeCart(items: CartItem[]): boolean {
  const hasVoucherLine = items.some(isQuizVoucherLine);
  const hasPaidLine = items.some((item) => !isQuizVoucherLine(item));
  if (!(hasVoucherLine && hasPaidLine)) {
    return false;
  }

  Alert.alert(
    'Check out your prize separately',
    'Your prize is redeemed on its own order. Remove your other items (or check them out first), then claim your prize so nothing is lost.',
    [{ text: 'OK' }]
  );
  return true;
}
