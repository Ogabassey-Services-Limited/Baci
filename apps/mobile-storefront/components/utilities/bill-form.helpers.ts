import type { BillItem } from '@/hooks/use-vtu-billers';
import { BILL_ITEM_LABELS } from '@/components/utilities/bill-form.constants';
import type { BillFormProps } from '@/components/utilities/bill-form.types';

export function getBillItemLevelLabel(
  type: BillFormProps['type'],
  depth: number
): string {
  return depth === 0 ? BILL_ITEM_LABELS[type] : `Additional Option ${depth}`;
}

export function getAmountForLeaf(billItem: BillItem | null): string {
  return billItem?.isAmountFixed && billItem.amount > 0
    ? String(billItem.amount)
    : '';
}

export function getInitialAmountForSelection(
  billItem: BillItem | null,
  initialAmount?: string
): string {
  const fixedAmount = getAmountForLeaf(billItem);
  return fixedAmount || initialAmount || '';
}
