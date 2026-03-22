import { describe, expect, it } from 'vitest';
import { bumpaOrderRowSchema } from '@/schemas/bumpa-orders';

describe('bumpaOrderRowSchema', () => {
  it('accepts a valid Bumpa order row', () => {
    const result = bumpaOrderRowSchema.safeParse({
      id: '4196546',
      'Order Number': '06397',
      Products: 'Iphone 17 Pro',
      'Customer Name': 'Ada Example',
      'Customer Email': 'ada@example.com',
      'Customer Phone': '08000000000',
      'Payment Status': 'PAID',
      Status: 'PROCESSING',
      'Shipping Status': 'UNFULFILLED',
      Channel: 'MOBILE',
      Origin: 'instagram',
      Total: '2150000.00',
      'Sub Total': '2000000.00',
      Discount: '0.00',
      'Amount Paid': '2150000.00',
      'Amount Due': '0.00',
      'Order Date': '2026-03-21 14:15:24',
      'Created At': '2026-03-21',
      'Updated At': '2026-03-21',
      'Shipping Price': '0.00',
      Tax: '150000.00',
      'Coupon Code': '',
      'Shipping Option': '',
      'Product SKU': '',
      'Product Quantity': '1.00',
    });

    expect(result.success).toBe(true);
  });

  it('rejects rows when required fields are empty', () => {
    const result = bumpaOrderRowSchema.safeParse({
      id: '',
      'Order Number': '',
      Products: '',
      'Customer Name': '',
      'Payment Status': '',
      Status: '',
      Total: '',
      'Sub Total': '',
      'Order Date': '',
      'Created At': '',
      'Product Quantity': '',
    });

    expect(result.success).toBe(false);
  });
});
