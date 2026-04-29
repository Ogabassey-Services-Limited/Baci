import type { BillItem } from '@/hooks/use-vtu-billers';
import {
  getAmountForLeaf,
  getBillItemLevelLabel,
  getInitialAmountForSelection,
} from './bill-form.helpers';

function createBillItem(overrides: Partial<BillItem> = {}): BillItem {
  return {
    amount: 0,
    isAmountFixed: false,
    itemCode: 'item-1',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'Item 1',
    ...overrides,
  };
}

describe('bill-form.helpers', () => {
  it('returns utility-specific labels for the first bill item level', () => {
    expect(getBillItemLevelLabel('power', 0)).toBe('Meter Type');
    expect(getBillItemLevelLabel('tv', 1)).toBe('Additional Option 1');
  });

  it('returns a fixed amount only for positive fixed-price leaves', () => {
    expect(
      getAmountForLeaf(createBillItem({ amount: 2500, isAmountFixed: true }))
    ).toBe('2500');
    expect(
      getAmountForLeaf(createBillItem({ amount: 2500, isAmountFixed: false }))
    ).toBe('');
    expect(getAmountForLeaf(null)).toBe('');
  });

  it('prefers fixed bill-item amounts over an initial amount', () => {
    expect(
      getInitialAmountForSelection(
        createBillItem({ amount: 1500, isAmountFixed: true }),
        '2000'
      )
    ).toBe('1500');
    expect(getInitialAmountForSelection(createBillItem(), '2000')).toBe('2000');
  });
});
