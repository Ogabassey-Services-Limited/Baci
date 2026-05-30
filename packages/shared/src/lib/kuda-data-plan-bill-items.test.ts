import { describe, expect, it } from 'vitest';
import {
  findKudaDataPlanBillItemByCode,
  flattenKudaDataPlanBillItems,
  type KudaDataPlanBillItem,
} from './kuda-data-plan-bill-items';

interface TestBillItem extends KudaDataPlanBillItem<TestBillItem> {
  amount: number;
  itemName: string;
  billItems?: TestBillItem[];
}

const nestedBillItems: TestBillItem[] = [
  {
    amount: 0,
    billItems: [
      {
        amount: 3500,
        itemCode: 'MTN-35GB-MONTHLY',
        itemName: 'MTN 3.5GB Monthly',
      },
    ],
    itemCode: 'MTN-MONTHLY',
    itemName: 'MTN Monthly Plans',
  },
  {
    amount: 500,
    itemCode: 'MTN-500MB-DAILY',
    itemName: 'MTN 500MB Daily',
  },
];

describe('Kuda data plan bill item helpers', () => {
  it('flattens nested data plan groups into selectable leaves', () => {
    expect(flattenKudaDataPlanBillItems(nestedBillItems)).toEqual([
      expect.objectContaining({ itemCode: 'MTN-35GB-MONTHLY' }),
      expect.objectContaining({ itemCode: 'MTN-500MB-DAILY' }),
    ]);
  });

  it('finds nested data package item codes', () => {
    expect(
      findKudaDataPlanBillItemByCode(nestedBillItems, 'MTN-35GB-MONTHLY')
    ).toEqual(expect.objectContaining({ amount: 3500 }));
  });

  it('returns null when no item code is provided', () => {
    expect(findKudaDataPlanBillItemByCode(nestedBillItems, null)).toBeNull();
  });
});
