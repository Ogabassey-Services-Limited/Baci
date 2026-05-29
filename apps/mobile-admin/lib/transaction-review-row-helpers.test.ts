import { describe, expect, it } from 'vitest';
import {
  buildSearchText,
  collectDetailValues,
  getSupplierNameFromMetadata,
  IMEI_KEYS,
  SERIAL_KEYS,
  toFiniteNumberOrNull,
} from './transaction-review-row-helpers';

describe('transaction-review-row-helpers', () => {
  it('normalizes searchable values and numeric inputs', () => {
    expect(buildSearchText(['  Order  ', null, ['SKU-1', 200]])).toBe(
      'order sku-1 200'
    );
    expect(toFiniteNumberOrNull('')).toBeNull();
    expect(toFiniteNumberOrNull('12.5')).toBe(12.5);
    expect(toFiniteNumberOrNull('bad')).toBeNull();
  });

  it('collects fulfillment identifiers by supported keys', () => {
    const values = [
      { imei: ' 123 ', serial_number: 'SN-1' },
      { nested: [{ imeiNumber: '456' }, { 's/n': 'SN-2' }] },
    ];

    expect(collectDetailValues(values, IMEI_KEYS)).toEqual(['123', '456']);
    expect(collectDetailValues(values, SERIAL_KEYS)).toEqual(['SN-1', 'SN-2']);
  });

  it('reads supplier metadata from supported keys in priority order', () => {
    expect(
      getSupplierNameFromMetadata({
        supplier: 'Fallback',
        supplier_name: '  Primary Supplier  ',
      })
    ).toBe('Primary Supplier');
    expect(getSupplierNameFromMetadata(null)).toBe('');
  });
});
