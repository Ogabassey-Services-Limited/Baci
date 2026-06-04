import { describe, expect, it } from 'vitest';
import {
  kudaBillerSchema,
  kudaBillItemSchema,
  monnifySupportedCategorySchema,
} from './vtu-billers';

describe('vtu biller schemas', () => {
  it('parses nested Kuda bill items', () => {
    const result = kudaBillItemSchema.safeParse({
      amount: 0,
      billItems: [
        {
          amount: 5000,
          isAmountFixed: true,
          itemCode: 'prepaid-residential',
          itemCurrencySymbol: 'NGN',
          itemFee: 100,
          itemName: 'Prepaid Residential',
        },
      ],
      isAmountFixed: false,
      itemCode: 'prepaid',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid',
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed Kuda bill item scalar fields', () => {
    expect(
      kudaBillItemSchema.safeParse({
        amount: '5000',
        isAmountFixed: true,
        itemCode: 'prepaid-residential',
        itemCurrencySymbol: 'NGN',
        itemFee: 100,
        itemName: 'Prepaid Residential',
      }).success
    ).toBe(false);

    expect(
      kudaBillItemSchema.safeParse({
        amount: 5000,
        isAmountFixed: true,
        itemCurrencySymbol: 'NGN',
        itemFee: 100,
        itemName: 'Prepaid Residential',
      }).success
    ).toBe(false);
  });

  it('rejects invalid nested Kuda bill items', () => {
    const result = kudaBillItemSchema.safeParse({
      amount: 0,
      billItems: [
        {
          amount: 5000,
          isAmountFixed: true,
          itemCode: 'prepaid-residential',
          itemCurrencySymbol: 'NGN',
          itemFee: '100',
        },
      ],
      isAmountFixed: false,
      itemCode: 'prepaid',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid',
    });

    expect(result.success).toBe(false);
  });

  it('accepts zero Kuda bill item amounts and rejects negative values', () => {
    const baseItem = {
      amount: 0,
      isAmountFixed: false,
      itemCode: 'prepaid',
      itemCurrencySymbol: 'NGN',
      itemFee: 0,
      itemName: 'Prepaid',
    };

    expect(kudaBillItemSchema.safeParse(baseItem).success).toBe(true);
    expect(
      kudaBillItemSchema.safeParse({
        ...baseItem,
        amount: -1,
      }).success
    ).toBe(false);
    expect(
      kudaBillItemSchema.safeParse({
        ...baseItem,
        itemFee: -1,
      }).success
    ).toBe(false);
  });

  it('rejects malformed Kuda billers', () => {
    const result = kudaBillerSchema.safeParse({
      billerId: 'ikedc',
      billerName: 'Ikeja Electric',
      billerType: 'electricity',
      categoryId: 'electricity',
    });

    expect(result.success).toBe(false);
  });

  it('rejects Kuda billers with invalid nested bill items', () => {
    const result = kudaBillerSchema.safeParse({
      billItems: [
        {
          amount: 0,
          isAmountFixed: false,
          itemCode: 'prepaid',
          itemCurrencySymbol: 'NGN',
          itemFee: -1,
          itemName: 'Prepaid',
        },
      ],
      billerId: 'ikedc',
      billerName: 'Ikeja Electric',
      billerType: 'electricity',
      categoryId: 'electricity',
      categoryName: 'Electricity',
    });

    expect(result.success).toBe(false);
  });

  it('limits Monnify discovery to supported bill categories', () => {
    expect(
      monnifySupportedCategorySchema.safeParse('electricity').success
    ).toBe(true);
    expect(monnifySupportedCategorySchema.safeParse('betting').success).toBe(
      false
    );
  });
});
