import type { Biller, BillItem } from '@/lib/vtu-schemas';
import {
  billerNameContainsBillItemName,
  findBillerByInitialName,
  findBillItemPath,
  findBillItemPathByName,
  findInitialBillerMatch,
  normalizeBillItemMatchText,
} from './bill-item-matching';

function createBillItem(overrides: Partial<BillItem>): BillItem {
  return {
    amount: 0,
    isAmountFixed: false,
    itemCode: 'ITEM',
    itemCurrencySymbol: '₦',
    itemFee: 0,
    itemName: 'Item',
    ...overrides,
  };
}

function createBiller(overrides: Partial<Biller>): Biller {
  return {
    billerId: 'biller-1',
    billerName: 'EKEDC NG',
    billerType: 'Electricity',
    categoryId: 'electricity',
    categoryName: 'Electricity',
    ...overrides,
  };
}

describe('bill item matching', () => {
  const prepaid = createBillItem({
    itemCode: 'KUD-ELE-EKED-002',
    itemName: 'EKEDC PREPAID',
  });
  const postpaid = createBillItem({
    itemCode: 'KUD-ELE-EKED-001',
    itemName: 'EKEDC POSTPAID',
  });
  const ekedc = createBiller({
    billItems: [prepaid, postpaid],
    billerId: 'ekedc',
    billerName: 'EKEDC NG',
  });

  it('finds nested bill item paths by item code', () => {
    const parent = createBillItem({
      billItems: [prepaid],
      itemCode: 'PARENT',
      itemName: 'Parent',
    });

    expect(findBillItemPath([parent], 'KUD-ELE-EKED-002')).toEqual([
      'PARENT',
      'KUD-ELE-EKED-002',
    ]);
  });

  it('normalizes names for dashed and underscored repeat values', () => {
    expect(normalizeBillItemMatchText('EKEDC_NG - EKEDC-PREPAID')).toBe(
      'ekedc ng ekedc prepaid'
    );
  });

  it('does not match very short bill item tokens as substrings', () => {
    expect(billerNameContainsBillItemName('dstv premium package', 'tv')).toBe(
      false
    );
  });

  it('finds a biller by exact, prefix, and token sequence matches', () => {
    const dstv = createBiller({
      billerId: 'dstv',
      billerName: 'DSTV',
    });
    const billers = [ekedc, dstv];

    expect(findBillerByInitialName(billers, 'EKEDC NG')).toBe(ekedc);
    expect(findBillerByInitialName(billers, 'EKEDC NG - EKEDC PREPAID')).toBe(
      ekedc
    );
    expect(findBillerByInitialName(billers, 'Last paid EKEDC NG prepaid')).toBe(
      ekedc
    );
  });

  it('finds bill item paths from item names in repeat labels', () => {
    expect(
      findBillItemPathByName(ekedc.billItems, 'EKEDC NG - EKEDC PREPAID')
    ).toEqual(['KUD-ELE-EKED-002']);
  });

  it('returns a specific initial biller match when the item identifier is known', () => {
    expect(
      findInitialBillerMatch({
        billers: [ekedc],
        initialBillItemIdentifier: 'KUD-ELE-EKED-001',
      })
    ).toEqual({
      biller: ekedc,
      codes: ['KUD-ELE-EKED-001'],
      resolvedToSpecificBillItem: true,
    });
  });
});
