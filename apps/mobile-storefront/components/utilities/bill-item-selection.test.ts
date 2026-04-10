import type { BillItem } from '@/lib/vtu-schemas';
import {
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';

const nestedItems: BillItem[] = [
  {
    itemCode: 'prepaid',
    itemName: 'Prepaid',
    amount: 0,
    itemCurrencySymbol: 'NGN',
    isAmountFixed: false,
    itemFee: 0,
    billItems: [
      {
        itemCode: 'residential',
        itemName: 'Residential',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
      },
      {
        itemCode: 'commercial',
        itemName: 'Commercial',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
      },
    ],
  },
  {
    itemCode: 'postpaid',
    itemName: 'Postpaid',
    amount: 0,
    itemCurrencySymbol: 'NGN',
    isAmountFixed: false,
    itemFee: 0,
  },
];

describe('bill-item-selection', () => {
  it('auto-selects single-option descendants', () => {
    const result = getResolvedBillItemCodes([
      {
        itemCode: 'dstv',
        itemName: 'DSTV',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
        billItems: [
          {
            itemCode: 'compact',
            itemName: 'Compact',
            amount: 15000,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: true,
            itemFee: 0,
          },
        ],
      },
    ]);

    expect(result).toEqual(['dstv', 'compact']);
  });

  it('marks the selection as incomplete when a deeper level still needs input', () => {
    const result = resolveBillItemSelection(nestedItems, ['prepaid']);

    expect(result.isComplete).toBe(false);
    expect(result.leaf?.itemCode).toBe('prepaid');
    expect(result.levels).toEqual([
      expect.objectContaining({ depth: 0, selectedCode: 'prepaid' }),
      expect.objectContaining({ depth: 1, selectedCode: null }),
    ]);
  });

  it('truncates stale descendants when a parent selection changes', () => {
    const result = updateBillItemSelection(
      nestedItems,
      ['prepaid', 'commercial'],
      0,
      'postpaid'
    );

    expect(result).toEqual(['postpaid']);
  });

  it('keeps the resolved leaf when a full path is selected', () => {
    const result = resolveBillItemSelection(nestedItems, [
      'prepaid',
      'commercial',
    ]);

    expect(result.isComplete).toBe(true);
    expect(result.leaf?.itemCode).toBe('commercial');
    expect(result.selectedPath.map((item) => item.itemCode)).toEqual([
      'prepaid',
      'commercial',
    ]);
  });
});
