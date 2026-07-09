import { describe, expect, it } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import {
  calculateProfitMargin,
  getCurrencySymbol,
  getVariantSummaryLabel,
  getVariantSummaryMeta,
} from './product-edit.helpers';

describe('product-edit.helpers', () => {
  const colors = {
    error: '#dc2626',
    success: '#16a34a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('returns supported currency symbols and falls back to naira for a missing code', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol(undefined)).toBe('₦');
  });

  it('falls back to the currency code itself for an unrecognized code', () => {
    expect(getCurrencySymbol('UNKNOWN')).toBe('UNKNOWN');
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

  it('omits machine attributes like color_hex from the summary label', () => {
    const variant = {
      attributes: [
        { key: 'Color', value: 'Black' },
        { key: 'color_hex', value: '#000000' },
        { key: 'Storage', value: '128GB' },
      ],
      client_id: 'variant-1',
      condition: 'new',
      cost_price: 500,
      images: [],
      price: 1000,
      primary_image: null,
      sku: '',
      stock_quantity: 0,
    } satisfies EditableProductVariant;

    expect(getVariantSummaryLabel(variant, 0)).toBe('New • Black / 128GB');
  });

  it('builds variant summary meta from price and stock', () => {
    const pricedVariant = {
      attributes: [],
      client_id: 'variant-1',
      cost_price: 500,
      images: [],
      price: 120000,
      primary_image: null,
      sku: '',
      stock_quantity: 3,
    } satisfies EditableProductVariant;
    const unpricedVariant = {
      ...pricedVariant,
      price: 0,
      stock_quantity: 0,
    };

    expect(getVariantSummaryMeta(pricedVariant, '₦')).toBe(
      '₦120,000 • 3 in stock'
    );
    expect(getVariantSummaryMeta(unpricedVariant, '₦')).toBe(
      'No price set • 0 in stock'
    );
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

  it('uses the secondary text color for break-even profit margins', () => {
    expect(calculateProfitMargin(colors, 500, 500)).toEqual({
      active: true,
      color: '#64748b',
      percentage: '0.0%',
      profit: 0,
    });
  });

  it('uses the error color for loss-making profit margins', () => {
    expect(calculateProfitMargin(colors, 400, 500)).toEqual({
      active: true,
      color: '#dc2626',
      percentage: '-25.0%',
      profit: -100,
    });
  });
});
