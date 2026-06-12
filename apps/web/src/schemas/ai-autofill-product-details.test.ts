import { describe, expect, it } from 'vitest';
import { AutofillProductDetailsInputSchema } from './ai-autofill-product-details';

describe('AutofillProductDetailsInputSchema', () => {
  it('accepts a valid product name and business type', () => {
    const result = AutofillProductDetailsInputSchema.safeParse({
      productName: 'samsung s24',
      businessType: 'electronics',
    });

    expect(result.success).toBe(true);
  });

  it('accepts inputs longer than the sanitize caps so truncation still applies', () => {
    const result = AutofillProductDetailsInputSchema.safeParse({
      productName: 'a'.repeat(500),
      businessType: 'b'.repeat(150),
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(
      AutofillProductDetailsInputSchema.safeParse({
        productName: '',
        businessType: 'electronics',
      }).success
    ).toBe(false);
    expect(
      AutofillProductDetailsInputSchema.safeParse({
        productName: 'iPhone 15',
        businessType: '',
      }).success
    ).toBe(false);
  });

  it('rejects oversized payloads', () => {
    expect(
      AutofillProductDetailsInputSchema.safeParse({
        productName: 'a'.repeat(2001),
        businessType: 'electronics',
      }).success
    ).toBe(false);
    expect(
      AutofillProductDetailsInputSchema.safeParse({
        productName: 'iPhone 15',
        businessType: 'b'.repeat(201),
      }).success
    ).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(
      AutofillProductDetailsInputSchema.safeParse({
        productName: 42,
        businessType: 'electronics',
      }).success
    ).toBe(false);
  });
});
