import { describe, expect, it } from 'vitest';
import { bumpaProductRowSchema } from '@/schemas/bumpa-products';

const validRow = {
  'Product ID': '4527981',
  'Variant ID': '',
  'Row Type': 'product',
  Title: 'Iphone 17 Pro',
  SKU: '',
  'Variant Name': '',
  Barcode: '',
  Description: '',
  Details: '',
  Unit: 'pc',
  Price: '2000000.00',
  Sales: '',
  Cost: '',
  Stock: '0',
  'Weight (kg)': '',
  Type: 'simple',
  Status: '0',
  Featured: '0',
  'Manage Stock': '1',
  'Sales Count': '1',
  'Ratings Cache': '',
  'Ratings Count': '0',
  'Currency Code': 'NGN',
  'Is Demo': '0',
  'Is Active': '1',
  'Min Order Qty': '1',
  'Max Order Qty': '',
  Collections: '',
  'Options Names': '',
  'Options Values': '',
  'Main Image': 'https://example.com/default.png',
  'Additional Images': '',
  'SEO Title': '',
  'SEO Description': '',
  'Product Type': '',
  Vendor: '',
  Gender: '',
  'Age Group': '',
  Condition: 'new',
  'Google Product Category': '',
  'Created At': '2026-03-21 14:14:25',
  'Updated At': '2026-03-21 14:15:25',
  Source: '',
  'Source ID': '',
};

describe('bumpaProductRowSchema', () => {
  it('accepts a valid Bumpa product row', () => {
    const result = bumpaProductRowSchema.safeParse(validRow);

    expect(result.success).toBe(true);
  });

  it('rejects rows when Product ID is empty', () => {
    const result = bumpaProductRowSchema.safeParse({
      ...validRow,
      'Product ID': '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects rows when Title is empty', () => {
    const result = bumpaProductRowSchema.safeParse({
      ...validRow,
      Title: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects rows when Price is empty', () => {
    const result = bumpaProductRowSchema.safeParse({
      ...validRow,
      Price: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects rows with invalid image URLs', () => {
    const result = bumpaProductRowSchema.safeParse({
      ...validRow,
      'Main Image': 'not-a-url',
    });

    expect(result.success).toBe(false);
  });
});
