import { describe, expect, it, vi } from 'vitest';
import {
  getMonnifyCategoryCode,
  normalizeKudaBillItem,
  normalizeMonnifyProducts,
} from './biller-normalizers';

vi.mock('@/lib/kuda-bills', () => ({
  getBillersByCategory: vi.fn(),
}));

vi.mock('@/lib/monnify-bills', () => ({
  getBillerProducts: vi.fn(),
  getBillers: vi.fn(),
}));

describe('biller normalizers', () => {
  it('maps supported Baci bill types to Monnify category codes', () => {
    expect(getMonnifyCategoryCode('electricity')).toBe('ELECTRICITY');
    expect(getMonnifyCategoryCode('cable_tv')).toBe('CABLE_TV');
    expect(getMonnifyCategoryCode('betting')).toBeUndefined();
  });

  it('preserves nested Kuda bill items while adding provider metadata', () => {
    expect(
      normalizeKudaBillItem({
        amount: 0,
        billItems: [
          {
            amount: 0,
            isAmountFixed: false,
            itemCode: 'residential-prepaid',
            itemCurrencySymbol: 'NGN',
            itemFee: 0,
            itemName: 'Residential Prepaid',
          },
        ],
        isAmountFixed: false,
        itemCode: 'prepaid',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'Prepaid',
      })
    ).toEqual({
      amount: 0,
      billItems: [
        {
          amount: 0,
          isAmountFixed: false,
          itemCode: 'residential-prepaid',
          itemCurrencySymbol: 'NGN',
          itemFee: 0,
          itemName: 'Residential Prepaid',
          provider: 'kuda',
        },
      ],
      isAmountFixed: false,
      itemCode: 'prepaid',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid',
      provider: 'kuda',
    });
  });

  it('normalizes Monnify products with provider routing fields', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'IKEDC',
        products: [
          {
            amount: null,
            billerCode: 'IKEDC',
            fee: null,
            isAmountFixed: null,
            name: 'Ikeja Prepaid',
            productCode: 'IKEDC_PREPAID',
          },
        ],
      })
    ).toEqual([
      {
        amount: 0,
        billerCode: 'IKEDC',
        isAmountFixed: false,
        itemCode: 'IKEDC_PREPAID',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'Ikeja Prepaid',
        productCode: 'IKEDC_PREPAID',
        provider: 'monnify',
      },
    ]);
  });

  it('defaults omitted optional Monnify product fields', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'IKEDC',
        products: [
          {
            billerCode: 'IKEDC',
            name: 'Ikeja Postpaid',
            productCode: 'IKEDC_POSTPAID',
          },
        ],
      })
    ).toEqual([
      {
        amount: 0,
        billerCode: 'IKEDC',
        isAmountFixed: false,
        itemCode: 'IKEDC_POSTPAID',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'Ikeja Postpaid',
        productCode: 'IKEDC_POSTPAID',
        provider: 'monnify',
      },
    ]);
  });

  it('returns no Monnify items for an empty product list', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'IKEDC',
        products: [],
      })
    ).toEqual([]);
  });
});
