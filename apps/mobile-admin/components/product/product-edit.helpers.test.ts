import { describe, expect, it } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import {
  calculateProfitMargin,
  getCurrencySymbol,
  getVariantSummaryLabel,
} from './product-edit.helpers';

describe('product-edit.helpers', () => {
  const colors = {
    error: '#dc2626',
    success: '#16a34a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('returns supported currency symbols and falls back to naira', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('UNKNOWN')).toBe('₦');
    expect(getCurrencySymbol(undefined)).toBe('₦');
  });

  it('builds the variant summary from the condition and concrete attributes', () => {
    const variant = {
      attributes: [
        { key: 'Storage', value: '256GB' },
        { key: 'Color', value: 'Black' },
      ],
      client_id: 'variant-1',
      condition: 'used',
      cost_price: 500,
      images: [],
      price: 1000,
      primary_image: null,
      sku: '',
      stock_quantity: 2,
    } satisfies EditableProductVariant;

    expect(getVariantSummaryLabel(variant, 0)).toBe('Used • 256GB / Black');
  });

  it('calculates an active profit margin with the correct color', () => {
    expect(calculateProfitMargin(colors, 1000, 400)).toEqual({
      active: true,
      color: '#16a34a',
      percentage: '60.0%',
      profit: 600,
    });
    expect(calculateProfitMargin(colors, 1000, 0)).toEqual({
      active: false,
      color: '#64748b',
      percentage: '0.0%',
      profit: 0,
    });
  });
});
