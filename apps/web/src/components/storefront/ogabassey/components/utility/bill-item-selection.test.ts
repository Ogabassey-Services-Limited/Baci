import { describe, expect, it } from 'vitest';
import {
  type BillItem,
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from '@/components/storefront/ogabassey/components/utility/bill-item-selection';

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

const deepItems: BillItem[] = [
  {
    itemCode: 'level-1',
    itemName: 'Level 1',
    amount: 0,
    itemCurrencySymbol: 'NGN',
    isAmountFixed: false,
    itemFee: 0,
    billItems: [
      {
        itemCode: 'level-2',
        itemName: 'Level 2',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
        billItems: [
          {
            itemCode: 'level-3',
            itemName: 'Level 3',
            amount: 100,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: true,
            itemFee: 0,
          },
        ],
      },
    ],
  },
];

describe('bill-item-selection', () => {
  it('getResolvedBillItemCodes returns empty for undefined input', () => {
    expect(getResolvedBillItemCodes(undefined)).toEqual([]);
  });

  it('resolveBillItemSelection returns empty/incomplete for missing bill items', () => {
    expect(resolveBillItemSelection([], [])).toEqual({
      isComplete: false,
      leaf: null,
      levels: [],
      selectedPath: [],
    });
  });

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
            amount: 15_000,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: true,
            itemFee: 0,
          },
        ],
      },
    ]);

    expect(result).toEqual(['dstv', 'compact']);
  });

  it('marks the selection as incomplete when a deeper level needs input', () => {
    const result = resolveBillItemSelection(nestedItems, ['prepaid']);

    expect(result.isComplete).toBe(false);
    expect(result.levels).toEqual([
      expect.objectContaining({ depth: 0, selectedCode: 'prepaid' }),
      expect.objectContaining({ depth: 1, selectedCode: null }),
    ]);
  });

  it('marks a selected leaf as complete', () => {
    const result = resolveBillItemSelection(nestedItems, ['postpaid']);

    expect(result.isComplete).toBe(true);
    expect(result.leaf?.itemCode).toBe('postpaid');
    expect(result.selectedPath.map((item) => item.itemCode)).toEqual([
      'postpaid',
    ]);
  });

  it('truncates stale descendants when a parent changes', () => {
    const result = updateBillItemSelection(
      nestedItems,
      ['prepaid', 'commercial'],
      0,
      'postpaid'
    );

    expect(result).toEqual(['postpaid']);
  });

  it('clamps negative update depths', () => {
    expect(
      updateBillItemSelection(
        nestedItems,
        ['prepaid', 'commercial'],
        -1,
        'postpaid'
      )
    ).toEqual(['postpaid']);
  });

  it('ignores invalid item codes', () => {
    expect(
      updateBillItemSelection(nestedItems, ['prepaid'], 1, 'missing')
    ).toEqual(['prepaid']);
  });

  it('auto-resolves deeply nested single-path structures', () => {
    expect(getResolvedBillItemCodes(deepItems)).toEqual([
      'level-1',
      'level-2',
      'level-3',
    ]);
  });

  it('marks deeply nested full selection as complete', () => {
    expect(
      resolveBillItemSelection(deepItems, ['level-1', 'level-2', 'level-3'])
        .isComplete
    ).toBe(true);
  });
});
