import { describe, expect, it } from '@jest/globals';
import { BillerListSchema, BillItemSchema } from '@/lib/vtu-schemas';

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

  it('preserves Monnify provider metadata', () => {
    const result = BillerListSchema.safeParse({
      billers: [
        {
          billerId: 'MTN',
          billerName: 'MTN',
          billerType: 'airtime',
          categoryId: 'AIRTIME',
          categoryName: 'airtime',
          provider: 'monnify',
          billerCode: 'MTN',
          billItems: [
            {
              itemCode: '13',
              itemName: 'MTN Mobile Top up',
              amount: 100,
              itemCurrencySymbol: 'NGN',
              isAmountFixed: false,
              itemFee: 0,
              provider: 'monnify',
              billerCode: 'MTN',
              productCode: '13',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billers[0]?.provider).toBe('monnify');
      expect(result.data.billers[0]?.billItems?.[0]?.productCode).toBe('13');
    }
  });
});
