import {
  findKudaDataPlanBillItemByCode,
  flattenKudaDataPlanBillItems,
} from '@baci/shared/lib';
import type { BillItem } from '@/hooks/use-vtu-billers';

export function flattenDataPlanBillItems(items: BillItem[]): BillItem[] {
  return flattenKudaDataPlanBillItems<BillItem>(items);
}

export function findDataPlanByCode(
  billItems: BillItem[] | undefined,
  itemCode: string | null
): BillItem | null {
  return findKudaDataPlanBillItemByCode<BillItem>(billItems, itemCode);
}

const DATA_PLAN_AMOUNT_FORMATTER_CACHE = new Map<number, Intl.NumberFormat>();

function getDataPlanAmountFormatter(
  minimumFractionDigits: number
): Intl.NumberFormat {
  let formatter = DATA_PLAN_AMOUNT_FORMATTER_CACHE.get(minimumFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-NG', {
      currency: 'NGN',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
      minimumFractionDigits,
      style: 'currency',
    });
    DATA_PLAN_AMOUNT_FORMATTER_CACHE.set(minimumFractionDigits, formatter);
  }
  return formatter;
}

export function formatDataPlanAmount(amount: number) {
  return getDataPlanAmountFormatter(Number.isInteger(amount) ? 0 : 2).format(
    amount
  );
}
