export interface KudaDataPlanBillItem<TBillItem = unknown> {
  billItems?: TBillItem[];
  itemCode: string;
}

export function flattenKudaDataPlanBillItems<
  TBillItem extends KudaDataPlanBillItem<TBillItem>,
>(items: readonly TBillItem[] | undefined): TBillItem[] {
  if (!items?.length) {
    return [];
  }

  return items.flatMap((item) => {
    const nested = flattenKudaDataPlanBillItems(item.billItems);
    return nested.length > 0 ? nested : [item];
  });
}

export function findKudaDataPlanBillItemByCode<
  TBillItem extends KudaDataPlanBillItem<TBillItem>,
>(
  items: readonly TBillItem[] | undefined,
  itemCode: string | null | undefined
): TBillItem | null {
  if (!itemCode) {
    return null;
  }

  return (
    flattenKudaDataPlanBillItems(items).find(
      (item) => item.itemCode === itemCode
    ) ?? null
  );
}
