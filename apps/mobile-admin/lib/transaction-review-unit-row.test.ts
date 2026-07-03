import { describe, expect, it } from 'vitest';
import { resolveTransactionReviewUnitRow } from './transaction-review-unit-row';

describe('resolveTransactionReviewUnitRow', () => {
  it('keeps stale out-of-range unit rows searchable without counting revenue or profit', () => {
    const row = resolveTransactionReviewUnitRow({
      baseCostPrice: 850_000,
      baseCostSource: 'order_item',
      baseImeiValues: ['ITEM-IMEI'],
      baseSerialValues: ['ITEM-SERIAL'],
      baseSupplierName: 'Fallback Supplier',
      quantity: 2,
      unitCost: {
        cost_price: 800_000,
        identifier_type: 'serial',
        identifier_value: 'STALE-SERIAL',
        supplier_name: 'Stale Supplier',
        unit_index: 5,
      },
      unitIndex: 5,
      unitPrice: 900_000,
    });

    expect(row).toMatchObject({
      costPrice: 800_000,
      costSource: 'unit',
      identifierType: 'serial',
      identifierValue: 'STALE-SERIAL',
      profit: 0,
      quantity: 0,
      revenue: 0,
      serialValues: ['STALE-SERIAL'],
      supplierName: 'Stale Supplier',
    });
    expect(row.searchTokens).toContain('STALE-SERIAL');
  });
});
