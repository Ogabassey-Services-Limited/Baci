import { describe, expect, it } from 'vitest';
import { buildOgabasseyProductVisibleSummary } from './build-product-visible-summary';

describe('buildOgabasseyProductVisibleSummary condition edge cases', () => {
  it('uses the parent condition when selectable variants omit their own condition', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'XPS 13',
        variants: [
          { attributes: { storage: '512 GB' } },
          { attributes: { storage: '512GB' } },
        ],
      })
    ).toBe('Dell XPS 13. Storage: 512 GB. Condition: New.');
  });

  it('does not add a stale parent condition to SKU-matrix variants', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'Latitude 7450',
        variants: [
          { condition: 'used', attributes: { storage: '512 GB' } },
        ],
      })
    ).toBe('Dell Latitude 7450. Storage: 512 GB. Condition: Used.');
  });

  it('does not replace the selector condition fallback with a variant attribute', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'XPS 13',
        variants: [
          {
            attributes: { condition: 'used', storage: '512 GB' },
            condition: null,
          },
        ],
      })
    ).toBe('Dell XPS 13. Storage: 512 GB. Condition: New.');
  });

  it('rejects condition facts when normalized condition aliases conflict', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        name: 'XPS 13',
        variants: [
          {
            attributes: { Condition: 'new', condition: 'used' },
            condition: 'new',
          },
        ],
      })
    ).toBeNull();
  });

  it('does not replace rejected variant condition aliases with the parent condition', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Dell',
        condition: 'new',
        name: 'Latitude 7450',
        variants: [
          {
            attributes: {
              condition: 'not-a-condition',
              storage: '512 GB',
            },
            condition: 'used',
          },
        ],
      })
    ).toBe('Dell Latitude 7450. Storage: 512 GB.');
  });

  it('does not advertise managed-stock variants with no inventory', () => {
    expect(
      buildOgabasseyProductVisibleSummary({
        brand: 'Apple',
        manage_stock: true,
        name: 'iPhone 16',
        variants: [
          {
            attributes: { storage: '128 GB' },
            condition: 'new',
            stock_quantity: 0,
          },
          {
            attributes: { storage: '256 GB' },
            condition: 'new',
            stock_quantity: 3,
          },
        ],
      })
    ).toBe('Apple iPhone 16. Storage: 256 GB. Condition: New.');
  });
});
