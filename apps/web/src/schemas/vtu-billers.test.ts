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

  it('rejects malformed Kuda billers', () => {
    const result = kudaBillerSchema.safeParse({
      billerId: 'ikedc',
      billerName: 'Ikeja Electric',
      billerType: 'electricity',
      categoryId: 'electricity',
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
