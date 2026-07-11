import type { CartItem } from '@/stores/cart-store';

export function isQuizVoucherLine(item: CartItem): boolean {
  return Boolean(item.voucher_token || item.voucher_award_id);
}
