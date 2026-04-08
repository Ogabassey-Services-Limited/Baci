import { describe, expect, it } from '@jest/globals';
import { BillItemSchema } from '@/lib/vtu-schemas';

describe('BillItemSchema', () => {
  it('rejects negative configured amounts', () => {
    const result = BillItemSchema.safeParse({
      itemCode: 'prepaid',
      itemName: 'Prepaid',
      amount: -100,
      itemCurrencySymbol: 'NGN',
      isAmountFixed: true,
      itemFee: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative provider fees', () => {
    const result = BillItemSchema.safeParse({
      itemCode: 'prepaid',
      itemName: 'Prepaid',
      amount: 1000,
      itemCurrencySymbol: 'NGN',
      isAmountFixed: true,
      itemFee: -5,
    });

    expect(result.success).toBe(false);
  });
});
