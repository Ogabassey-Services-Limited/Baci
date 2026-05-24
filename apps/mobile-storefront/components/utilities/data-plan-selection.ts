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

export function formatDataPlanAmount(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    style: 'currency',
  }).format(amount);
}
