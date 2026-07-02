import { describe, expect, it } from 'vitest';
import {
  buildFulfillmentUnitIndex,
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

  it('derives serialized inventory units from item fulfillment data', () => {
    // Multi-unit serialized line: units live on the item, not order-level.
    const byIndex = buildFulfillmentUnitIndex(
      { items: [] },
      {
        inventoryUnits: [
          { inventoryUnitId: 'u1', identifierType: 'imei', identifierValue: '111' },
          { inventoryUnitId: 'u2', identifierType: 'serial', identifierValue: 'SN-2' },
        ],
      },
      'item-1'
    );

    expect([...byIndex.keys()].sort()).toEqual([0, 1]);
    expect(byIndex.get(0)?.imeiValues).toEqual(['111']);
    expect(byIndex.get(1)?.serialValues).toEqual(['SN-2']);
  });

  it('lets order-level fulfillment units win over item inventory units', () => {
    const byIndex = buildFulfillmentUnitIndex(
      {
        items: [
          { orderItemId: 'item-1', unitIndex: 0, imei: '999' },
        ],
      },
      {
        inventoryUnits: [
          { inventoryUnitId: 'u1', identifierType: 'imei', identifierValue: '111' },
        ],
      },
      'item-1'
    );

    expect(byIndex.get(0)?.imeiValues).toEqual(['999']);
  });
});
