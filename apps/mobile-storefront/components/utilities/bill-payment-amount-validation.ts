import type { BillItem } from '@/hooks/use-vtu-billers';

const MIN_BILL_PAYMENT_AMOUNT = 50;
const MAX_BILL_PAYMENT_AMOUNT = 500_000;
const AMOUNT_DISPLAY_LOCALE = 'en-NG';

function formatNairaAmount(amount: number) {
  return `₦${amount.toLocaleString(AMOUNT_DISPLAY_LOCALE)}`;
}

export function getBillPaymentAmountError(
  numericAmount: number,
  selectedBillItem: Pick<BillItem, 'maxAmount' | 'minAmount'> | null
) {
  if (!Number.isFinite(numericAmount)) {
    return 'Please enter a valid amount.';
  }
  if (
    numericAmount < MIN_BILL_PAYMENT_AMOUNT ||
    numericAmount > MAX_BILL_PAYMENT_AMOUNT
  ) {
    return `Amount must be between ${formatNairaAmount(MIN_BILL_PAYMENT_AMOUNT)} and ${formatNairaAmount(MAX_BILL_PAYMENT_AMOUNT)}.`;
  }
  if (
    selectedBillItem?.minAmount != null &&
    numericAmount < selectedBillItem.minAmount
  ) {
    return `Minimum amount for this product is ${formatNairaAmount(selectedBillItem.minAmount)}.`;
  }
  if (
    selectedBillItem?.maxAmount != null &&
    numericAmount > selectedBillItem.maxAmount
  ) {
    return `Maximum amount for this product is ${formatNairaAmount(selectedBillItem.maxAmount)}.`;
  }
  return null;
}
