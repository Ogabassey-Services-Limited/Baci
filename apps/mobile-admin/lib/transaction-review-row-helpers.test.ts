import { describe, expect, it } from 'vitest';
import {
  buildFulfillmentUnitIndex,
  buildSearchText,
  collectDetailValues,
  getSafeLegacyOrderDetails,
  getSupplierNameFromMetadata,
  getUnitCostByIndex,
  IMEI_KEYS,
  SERIAL_KEYS,
  toFiniteNumberOrNull,
} from './transaction-review-row-helpers';
import type { TransactionReviewUnitCostRow } from './transaction-review-types';

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
          {
            inventoryUnitId: 'u1',
            identifierType: 'imei',
            identifierValue: '111',
          },
          {
            inventoryUnitId: 'u2',
            identifierType: 'serial',
            identifierValue: 'SN-2',
          },
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
        items: [{ orderItemId: 'item-1', unitIndex: 0, imei: '999' }],
      },
      {
        inventoryUnits: [
          {
            inventoryUnitId: 'u1',
            identifierType: 'imei',
            identifierValue: '111',
          },
        ],
      },
      'item-1'
    );

    expect(byIndex.get(0)?.imeiValues).toEqual(['999']);
  });

  it('uses legacy order details only for a single one-unit order item', () => {
    const fulfillmentDetails = { serialNumber: 'LEGACY-SN' };

    expect(getSafeLegacyOrderDetails(fulfillmentDetails, 1, 1)).toBe(
      fulfillmentDetails
    );
    expect(getSafeLegacyOrderDetails(fulfillmentDetails, 2, 1)).toBeNull();
    expect(getSafeLegacyOrderDetails(fulfillmentDetails, 1, 2)).toBeNull();
  });

  it('indexes unit costs by valid unit index and keeps the first duplicate', () => {
    const unitCosts: TransactionReviewUnitCostRow[] = [
      {
        cost_price: 100,
        identifier_type: 'serial',
        identifier_value: 'SN-1',
        supplier_name: 'First Supplier',
        unit_index: 0,
      },
      {
        cost_price: 200,
        identifier_type: 'serial',
        identifier_value: 'SN-1-DUPE',
        supplier_name: 'Duplicate Supplier',
        unit_index: 0,
      },
      {
        cost_price: 300,
        identifier_type: 'serial',
        identifier_value: 'SN-NEGATIVE',
        supplier_name: 'Invalid Supplier',
        unit_index: -1,
      },
      {
        cost_price: 400,
        identifier_type: 'serial',
        identifier_value: 'SN-FRACTION',
        supplier_name: 'Invalid Supplier',
        unit_index: 1.5,
      },
      {
        cost_price: 500,
        identifier_type: 'serial',
        identifier_value: 'SN-NULL',
        supplier_name: 'Invalid Supplier',
        unit_index: null,
      },
      {
        cost_price: 600,
        identifier_type: 'imei',
        identifier_value: '353456789012345',
        supplier_name: 'Second Supplier',
        unit_index: 2,
      },
    ];

    const byIndex = getUnitCostByIndex(unitCosts);

    expect([...byIndex.keys()]).toEqual([0, 2]);
    expect(byIndex.get(0)?.supplier_name).toBe('First Supplier');
    expect(byIndex.get(2)?.supplier_name).toBe('Second Supplier');
  });
});
