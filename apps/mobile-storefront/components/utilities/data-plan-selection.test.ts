import type { BillItem } from '@/hooks/use-vtu-billers';
import {
  findDataPlanByCode,
  flattenDataPlanBillItems,
  formatDataPlanAmount,
} from './data-plan-selection';

const nestedBillItems: BillItem[] = [
  {
    amount: 0,
    billItems: [
      {
        amount: 3500,
        isAmountFixed: true,
        itemCode: 'MTN-35GB-MONTHLY',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'MTN 3.5GB Monthly',
      },
    ],
    isAmountFixed: false,
    itemCode: 'MTN-MONTHLY',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'MTN Monthly Plans',
  },
];

describe('data plan selection helpers', () => {
  it('flattens nested bill item groups into selectable package leaves', () => {
    expect(flattenDataPlanBillItems(nestedBillItems)).toEqual([
      expect.objectContaining({ itemCode: 'MTN-35GB-MONTHLY' }),
    ]);
  });

  it('finds nested data package item codes', () => {
    expect(findDataPlanByCode(nestedBillItems, 'MTN-35GB-MONTHLY')).toEqual(
      expect.objectContaining({ amount: 3500 })
    );
  });

  it('formats whole-naira data amounts without trailing decimals', () => {
    expect(formatDataPlanAmount(3500)).toBe('₦3,500');
  });
});
