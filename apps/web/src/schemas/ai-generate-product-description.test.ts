import { describe, expect, it } from 'vitest';
import { generateProductDescriptionInputSchema } from './ai-generate-product-description';

describe('generateProductDescriptionInputSchema', () => {
  it('accepts a minimal valid input', () => {
    const result = generateProductDescriptionInputSchema.safeParse({
      productName: 'Leather Tote Bag',
    });

    expect(result.success).toBe(true);
  });

  it('accepts all optional fields within bounds', () => {
    const result = generateProductDescriptionInputSchema.safeParse({
      productName: 'Leather Tote Bag',
      keywords: ['leather', 'tote'],
      brandVoice: 'Playful and warm',
      targetAudience: 'Young professionals',
      businessType: 'fashion',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty or overlong product name', () => {
    expect(
      generateProductDescriptionInputSchema.safeParse({ productName: '' })
        .success
    ).toBe(false);
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'a'.repeat(201),
      }).success
    ).toBe(false);
  });

  it('rejects more than 10 keywords and keywords over 50 characters', () => {
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'Bag',
        keywords: Array.from({ length: 11 }, () => 'keyword'),
      }).success
    ).toBe(false);
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'Bag',
        keywords: ['a'.repeat(51)],
      }).success
    ).toBe(false);
  });

  it('rejects overlong brandVoice, targetAudience, and businessType', () => {
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'Bag',
        brandVoice: 'a'.repeat(201),
      }).success
    ).toBe(false);
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'Bag',
        targetAudience: 'a'.repeat(201),
      }).success
    ).toBe(false);
    expect(
      generateProductDescriptionInputSchema.safeParse({
        productName: 'Bag',
        businessType: 'a'.repeat(101),
      }).success
    ).toBe(false);
  });
});
