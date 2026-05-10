import { describe, expect, it } from 'vitest';
import {
  aiJobTypeSchema,
  createAiJobSchema,
  storefrontLayoutJobInputSchema,
} from './ai-jobs';

describe('aiJobTypeSchema', () => {
  it('accepts supported job types', () => {
    expect(aiJobTypeSchema.parse('price_list_processing')).toBe(
      'price_list_processing'
    );
    expect(aiJobTypeSchema.parse('storefront_layout_generation')).toBe(
      'storefront_layout_generation'
    );
  });
});

describe('storefrontLayoutJobInputSchema', () => {
  it('accepts a valid storefront layout generation input', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: 'home',
      businessName: 'Bassey Phones',
      businessType: 'electronics',
      brandColors: { primary: '#111827', accent: '#f59e0b' },
      createdPageConfigUpdatedAt: '2026-04-28T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid storefront input');
    expect(result.data.businessName).toBe('Bassey Phones');
  });

  it('rejects missing business context', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: 'home',
      brandColors: null,
      createdPageConfigUpdatedAt: null,
    });

    expect(result.success).toBe(false);
  });

  it('rejects datetimes without timezone offsets', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: 'home',
      businessName: 'Bassey Phones',
      businessType: 'electronics',
      brandColors: null,
      createdPageConfigUpdatedAt: '2026-04-28T10:00:00',
    });

    expect(result.success).toBe(false);
  });

  it('allows nullable brand colors and generated timestamp', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: ' home ',
      businessName: ' Bassey Phones ',
      businessType: ' electronics ',
      brandColors: null,
      createdPageConfigUpdatedAt: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected nullable fields to parse');
    expect(result.data).toEqual(
      expect.objectContaining({
        pageSlug: 'home',
        businessName: 'Bassey Phones',
        businessType: 'electronics',
      })
    );
  });
});

describe('createAiJobSchema', () => {
  it('validates storefront layout job input by type', () => {
    const result = createAiJobSchema.safeParse({
      type: 'storefront_layout_generation',
      input: {
        pageSlug: 'home',
        businessName: 'Bassey Phones',
        businessType: 'electronics',
        brandColors: null,
        createdPageConfigUpdatedAt: null,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed storefront layout job input by type', () => {
    const result = createAiJobSchema.safeParse({
      type: 'storefront_layout_generation',
      input: {
        pageSlug: 'home',
        businessName: '',
        businessType: 'electronics',
      },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected malformed input to fail');
    expect(result.error.flatten().fieldErrors.input).toBeDefined();
  });

  it('does not validate legacy price list input as storefront input', () => {
    const result = createAiJobSchema.safeParse({
      type: 'price_list_processing',
      input: { filePath: 'uploads/list.csv' },
    });

    expect(result.success).toBe(true);
  });
});
