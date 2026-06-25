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
    const { billers, matchedMonnifyProducts } = dedupeElectricityBillers(
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
    expect(
      matchedMonnifyProducts.get('biller-ekedc-pre')?.has('biller-ekedc-pre')
    ).toBe(true);
    expect(
      matchedMonnifyProducts.get('biller-ekedc-post')?.has('biller-ekedc-post')
    ).toBe(true);
    // Display stays Kuda (logo + short name preserved).
    expect(billers[0]?.provider).toBe('kuda');
    expect(billers[0]?.billerIconUrl).toBe('https://cdn.kuda.com/ekedc.png');
  });

  it('derives meter type from the Monnify name when the code lacks it', () => {
    const genericCodeBiller: NormalizedBiller = {
      ...monnifyBiller('IKEDC-PRE', 'Ikeja Electricity Distribution Prepaid'),
      billerCode: 'IKEDC-PRE',
    };
    const kuda: NormalizedBiller = {
      ...kudaBiller(),
      billerId: 'IKEDC',
      billerName: 'IKEDC NG',
      billItems: [
        {
          itemCode: 'KUD-ELE-IKED-002',
          itemName: 'IKEDC PREPAID',
          amount: 0,
          itemCurrencySymbol: 'NGN',
          isAmountFixed: false,
          itemFee: 0,
          provider: 'kuda',
        },
      ],
    };

    const { billers } = dedupeElectricityBillers([kuda], [genericCodeBiller]);
    const prepaid = billers[0]?.billItems?.find(
      (i) => i.itemName === 'IKEDC PREPAID'
    );
    expect(prepaid?.monnifyBillerCode).toBe('IKEDC-PRE');
  });

  it('folds APLE (Kuda) onto Aba (Monnify) via the alias', () => {
    const kuda: NormalizedBiller = {
      ...kudaBiller(),
      billerId: 'APLE',
      billerName: 'APLE NG',
      billItems: [
        {
          itemCode: 'KUD-ELE-APLE-001',
          itemName: 'APLE PREPAID',
          amount: 0,
          itemCurrencySymbol: 'NGN',
          isAmountFixed: false,
          itemFee: 0,
          provider: 'kuda',
        },
      ],
    };
    const { billers } = dedupeElectricityBillers(
      [kuda],
      [monnifyBiller('biller-aba-pre', 'Aba Power Prepaid')]
    );
    const prepaid = billers[0]?.billItems?.find(
      (i) => i.itemName === 'APLE PREPAID'
    );
    expect(prepaid?.monnifyBillerCode).toBe('biller-aba-pre');
  });

  it('keeps a multi-product Monnify biller when only one meter type matched', () => {
    const multiProduct: NormalizedBiller = {
      ...monnifyBiller('biller-ekedc', 'Eko Electricity'),
      billItems: [
        {
          itemCode: 'p1',
          itemName: 'Eko Prepaid',
          amount: 0,
          itemCurrencySymbol: 'NGN',
          isAmountFixed: false,
          itemFee: 0,
          provider: 'monnify',
          billerCode: 'biller-ekedc',
          productCode: 'eko-pre',
        },
        {
          itemCode: 'p2',
          itemName: 'Eko Postpaid',
          amount: 0,
          itemCurrencySymbol: 'NGN',
          isAmountFixed: false,
          itemFee: 0,
          provider: 'monnify',
          billerCode: 'biller-ekedc',
          productCode: 'eko-post',
        },
      ],
    };
    // Kuda biller only offers PREPAID, so the postpaid product stays unmatched.
    const kudaPrepaidOnly: NormalizedBiller = {
      ...kudaBiller(),
      billItems: [kudaBiller().billItems?.[0] ?? []].flat(),
    };

    const { matchedMonnifyProducts } = dedupeElectricityBillers(
      [kudaPrepaidOnly],
      [multiProduct]
    );
    // Only the prepaid product folded; postpaid stays unmatched so the route
    // prunes prepaid but keeps the postpaid product on the retained card.
    const folded = matchedMonnifyProducts.get('biller-ekedc');
    expect(folded?.has('eko-pre')).toBe(true);
    expect(folded?.has('eko-post')).toBe(false);
  });

  it('leaves Kuda items untouched when no Monnify DISCO matches', () => {
    const { billers, matchedMonnifyProducts } = dedupeElectricityBillers(
      [kudaBiller()],
      [monnifyBiller('biller-phedc-pre', 'Port Harcourt Electricity Prepaid')]
    );

    const prepaid = billers[0]?.billItems?.find(
      (i) => i.itemName === 'EKEDC PREPAID'
    );
    expect(prepaid?.monnifyBillerCode).toBeUndefined();
    expect(matchedMonnifyProducts.size).toBe(0);
  });
});
