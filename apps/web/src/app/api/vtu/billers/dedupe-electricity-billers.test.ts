import { describe, expect, it } from 'vitest';
import type { NormalizedBiller } from './biller-normalizers';
import { dedupeElectricityBillers } from './dedupe-electricity-billers';

function kudaBiller(): NormalizedBiller {
  return {
    billerId: 'EKEDC',
    billerName: 'EKEDC NG',
    billerType: 'electricity',
    categoryId: 'electricity',
    categoryName: 'Electricity',
    provider: 'kuda',
    billerIconUrl: 'https://cdn.kuda.com/ekedc.png',
    billItems: [
      {
        itemCode: 'KUD-ELE-EKED-002',
        itemName: 'EKEDC PREPAID',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
        provider: 'kuda',
      },
      {
        itemCode: 'KUD-ELE-EKED-001',
        itemName: 'EKEDC POSTPAID',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
        provider: 'kuda',
      },
    ],
  };
}

function monnifyBiller(code: string, name: string): NormalizedBiller {
  return {
    billerId: code,
    billerName: name,
    billerType: 'electricity',
    categoryId: 'electricity',
    categoryName: 'electricity',
    provider: 'monnify',
    billerCode: code,
    billItems: [
      {
        itemCode: code,
        itemName: name,
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
        provider: 'monnify',
        billerCode: code,
        productCode: code,
      },
    ],
  };
}

describe('dedupeElectricityBillers', () => {
  it('attaches matching Monnify pre/post codes onto the Kuda bill items', () => {
    const { billers, matchedMonnifyBillerCodes } = dedupeElectricityBillers(
      [kudaBiller()],
      [
        monnifyBiller(
          'biller-ekedc-pre',
          'Eko Electricity Distribution Prepaid'
        ),
        monnifyBiller(
          'biller-ekedc-post',
          'Eko Electricity Distribution Postpaid'
        ),
      ]
    );

    expect(billers).toHaveLength(1);
    const items = billers[0]?.billItems ?? [];
    const prepaid = items.find((i) => i.itemName === 'EKEDC PREPAID');
    const postpaid = items.find((i) => i.itemName === 'EKEDC POSTPAID');
    expect(prepaid?.monnifyBillerCode).toBe('biller-ekedc-pre');
    expect(prepaid?.monnifyProductCode).toBe('biller-ekedc-pre');
    expect(postpaid?.monnifyBillerCode).toBe('biller-ekedc-post');
    expect(matchedMonnifyBillerCodes.has('biller-ekedc-pre')).toBe(true);
    expect(matchedMonnifyBillerCodes.has('biller-ekedc-post')).toBe(true);
    // Display stays Kuda (logo + short name preserved).
    expect(billers[0]?.provider).toBe('kuda');
    expect(billers[0]?.billerIconUrl).toBe('https://cdn.kuda.com/ekedc.png');
  });

  it('leaves Kuda items untouched when no Monnify DISCO matches', () => {
    const { billers, matchedMonnifyBillerCodes } = dedupeElectricityBillers(
      [kudaBiller()],
      [monnifyBiller('biller-phedc-pre', 'Port Harcourt Electricity Prepaid')]
    );

    const prepaid = billers[0]?.billItems?.find(
      (i) => i.itemName === 'EKEDC PREPAID'
    );
    expect(prepaid?.monnifyBillerCode).toBeUndefined();
    expect(matchedMonnifyBillerCodes.size).toBe(0);
  });
});
