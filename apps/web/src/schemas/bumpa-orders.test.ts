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

  it('accepts rows with blank customer name when email exists', () => {
    const result = bumpaOrderRowSchema.safeParse({
      id: '1107127',
      'Order Number': '04151-1',
      Products: 'IPhone XR 64gb (Premium Used)',
      'Customer Name': '',
      'Customer Email': 'khenzobox@outlook.com',
      'Customer Phone': '',
      'Payment Status': 'PAID',
      Status: 'PROCESSING',
      'Shipping Status': 'UNFULFILLED',
      Channel: 'MOBILE',
      Origin: 'instagram',
      Total: '250000.00',
      'Sub Total': '250000.00',
      Discount: '0.00',
      'Amount Paid': '250000.00',
      'Amount Due': '0.00',
      'Order Date': '2024-08-13 23:20:25',
      'Created At': '2024-08-13',
      'Updated At': '2024-08-13',
      'Shipping Price': '0.00',
      Tax: '0.00',
      'Coupon Code': '',
      'Shipping Option': '',
      'Product SKU': '',
      'Product Quantity': '1.00',
    });

    expect(result.success).toBe(true);
  });

  it('rejects fully anonymous rows with a clear customer identity message', () => {
    const result = bumpaOrderRowSchema.safeParse({
      id: '2250705',
      'Order Number': '05360',
      Products: 'iPhone 16 256gb (Brand New ) | Insurance | Charger',
      'Customer Name': '',
      'Customer Email': '',
      'Customer Phone': '',
      'Payment Status': 'PAID',
      Status: 'PROCESSING',
      'Shipping Status': 'UNFULFILLED',
      Channel: 'MOBILE',
      Origin: 'instagram',
      Total: '1343000.00',
      'Sub Total': '1343000.00',
      Discount: '0.00',
      'Amount Paid': '1343000.00',
      'Amount Due': '0.00',
      'Order Date': '2025-05-09 17:50:19',
      'Created At': '2025-05-09',
      'Updated At': '2025-05-09',
      'Shipping Price': '0.00',
      Tax: '0.00',
      'Coupon Code': '',
      'Shipping Option': '',
      'Product SKU': ' |  | ',
      'Product Quantity': '1.00 | 1.00 | 1.00',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Customer name, email, or phone is required'
    );
  });

  it('rejects rows when required fields are empty', () => {
    const result = bumpaOrderRowSchema.safeParse({
      id: '',
      'Order Number': '',
      Products: '',
      'Payment Status': '',
      Status: '',
      Total: '',
      'Sub Total': '',
      'Order Date': '',
      'Created At': '',
      'Product Quantity': '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Products is missing' }),
        expect.objectContaining({ message: 'Product quantity is missing' }),
      ])
    );
  });
});
