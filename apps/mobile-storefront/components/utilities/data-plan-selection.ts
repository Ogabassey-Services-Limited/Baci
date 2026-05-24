import type { BillItem } from '@/hooks/use-vtu-billers';

export function flattenDataPlanBillItems(items: BillItem[]): BillItem[] {
  return items.flatMap((item) => {
    if (item.billItems?.length) {
      return flattenDataPlanBillItems(item.billItems);
    }
    return [item];
  });
}

export function findDataPlanByCode(
  billItems: BillItem[] | undefined,
  itemCode: string | null
): BillItem | null {
  if (!billItems?.length || !itemCode) {
    return null;
  }

  return (
    flattenDataPlanBillItems(billItems).find(
      (item) => item.itemCode === itemCode
    ) ?? null
  );
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
