import { BILL_ITEM_LABELS } from '@/components/utilities/bill-form.constants';
import type { BillFormProps } from '@/components/utilities/bill-form.types';
import type { BillItem } from '@/hooks/use-vtu-billers';

export function parseUtilityAmount(value: string): number {
  const withoutCommas = value.trim().replace(/,/g, '');
  if (withoutCommas.includes('-')) {
    return 0;
  }
  const digitsAndDecimals = withoutCommas.replace(/[^0-9.]/g, '');
  // Multiple decimal separators are collapsed into one fractional value so
  // pasted values like "1.2.3" parse as 1.23 instead of failing mid-entry.
  const [whole = '', ...decimalParts] = digitsAndDecimals.split('.');
  const normalized = `${whole}${
    decimalParts.length ? `.${decimalParts.join('')}` : ''
  }`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

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
