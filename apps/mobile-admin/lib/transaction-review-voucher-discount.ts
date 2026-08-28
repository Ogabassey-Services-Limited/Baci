import type { DiscountableTransactionItem } from './transaction-review-discount-allocations';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export function getQuizVoucherDiscountAmount(
  items: DiscountableTransactionItem[]
) {
  return items.reduce((sum, item) => {
    if (
      typeof item.quiz_award_id !== 'string' ||
      item.quiz_award_id.trim().length === 0
    ) {
      return sum;
    }

    const merchandiseTotal =
      Math.max(0, toFiniteNumberOrNull(item.price) ?? 0) *
      Math.max(0, toFiniteNumberOrNull(item.quantity) ?? 1);
    return sum + merchandiseTotal;
  }, 0);
}
