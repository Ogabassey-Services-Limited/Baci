import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import {
  getMonnifyCategoryCode,
  normalizeKudaBillItem,
  normalizeMonnifyProducts,
} from './biller-normalizers';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/kuda-bills', () => ({
  getBillersByCategory: vi.fn(),
}));

vi.mock('@/lib/monnify-bills', () => ({
  getBillerProducts: vi.fn(),
  getBillers: vi.fn(),
}));

describe('biller normalizers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps supported Baci bill types to Monnify category codes', () => {
    expect(getMonnifyCategoryCode('electricity')).toBe('ELECTRICITY');
    expect(getMonnifyCategoryCode('cable_tv')).toBe('CABLE_TV');
    expect(getMonnifyCategoryCode('airtime')).toBe('AIRTIME');
    expect(getMonnifyCategoryCode('data')).toBeUndefined();
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
            categoryCode: undefined,
            fee: null,
            isAmountFixed: null,
            maxAmount: null,
            minAmount: null,
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

  it('normalizes current Monnify product fields', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'MTN',
        products: [
          {
            amount: null,
            billerCode: 'MTN',
            categoryCode: 'AIRTIME',
            fee: null,
            isAmountFixed: false,
            maxAmount: 50_000,
            minAmount: 100,
            name: 'MTN Mobile Top up',
            productCode: '13',
          },
        ],
      })
    ).toEqual([
      {
        amount: 100,
        billerCode: 'MTN',
        isAmountFixed: false,
        itemCode: '13',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'MTN Mobile Top up',
        maxAmount: 50_000,
        minAmount: 100,
        productCode: '13',
        provider: 'monnify',
      },
    ]);
  });

  it('skips Monnify products with invalid amount ranges', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'MTN',
        products: [
          {
            amount: null,
            billerCode: 'MTN',
            categoryCode: 'AIRTIME',
            fee: null,
            isAmountFixed: false,
            maxAmount: 100,
            minAmount: 1000,
            name: 'MTN Mobile Top up',
            productCode: '13',
          },
        ],
      })
    ).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Skipping Monnify product with invalid amount range',
      billerCode: 'MTN',
      maxAmount: 100,
      minAmount: 1000,
      productCode: '13',
    });
  });

  it('defaults omitted optional Monnify product fields', () => {
    expect(
      normalizeMonnifyProducts({
        billerCode: 'IKEDC',
        products: [
          {
            billerCode: 'IKEDC',
            amount: null,
            categoryCode: undefined,
            fee: null,
            isAmountFixed: null,
            maxAmount: null,
            minAmount: null,
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
