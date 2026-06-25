import { describe, expect, it } from '@jest/globals';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { resolveBillFulfillment } from './resolve-bill-fulfillment';

const biller = (overrides: Partial<Biller> = {}): Biller => ({
  billerId: 'EKEDC',
  billerName: 'EKEDC NG',
  billerType: 'electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
  provider: 'kuda',
  billItems: [],
  ...overrides,
});

const item = (overrides: Partial<BillItem> = {}): BillItem => ({
  itemCode: 'KUD-ELE-EKED-002',
  itemName: 'EKEDC PREPAID',
  amount: 0,
  itemCurrencySymbol: 'NGN',
  isAmountFixed: false,
  itemFee: 0,
  provider: 'kuda',
  ...overrides,
});

describe('resolveBillFulfillment', () => {
  it('routes a folded electricity item through Monnify', () => {
    const result = resolveBillFulfillment(
      item({
        monnifyBillerCode: 'biller-ekedc-pre',
        monnifyProductCode: 'biller-ekedc-pre',
      }),
      biller(),
      'KUD-ELE-EKED-002'
    );
    expect(result).toEqual({
      provider: 'monnify',
      billerCode: 'biller-ekedc-pre',
      productCode: 'biller-ekedc-pre',
    });
  });

  it('falls back to the item/biller provider when not folded', () => {
    const result = resolveBillFulfillment(item(), biller(), 'KUD-ELE-EKED-002');
    expect(result.provider).toBe('kuda');
    expect(result.productCode).toBeUndefined();
  });

  it('uses the identifier as Monnify productCode for native Monnify items', () => {
    const result = resolveBillFulfillment(
      item({ provider: 'monnify', billerCode: 'BET9JA' }),
      biller({ provider: 'monnify' }),
      'sportybet-id'
    );
    expect(result.provider).toBe('monnify');
    expect(result.productCode).toBe('sportybet-id');
  });
});
