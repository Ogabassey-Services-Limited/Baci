import { describe, expect, it } from 'vitest';
import { buildBumpaOrderPreviewSummary } from './build-bumpa-order-preview-summary';
import type {
  ImportPreviewRow,
  NormalizedImportedCustomer,
  NormalizedImportedOrder,
} from './bumpa-types';

function makeCustomer(
  overrides: Partial<NormalizedImportedCustomer> = {}
): NormalizedImportedCustomer {
  return {
    fullName: 'Test Customer',
    firstName: 'Test',
    lastName: 'Customer',
    email: 'test@example.com',
    phone: '08000000000',
    claimable: true,
    ...overrides,
  };
}

function makeOrder(
  overrides: Partial<NormalizedImportedOrder> = {}
): NormalizedImportedOrder {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: '123',
    orderNumber: 'ORD-001',
    customer: makeCustomer(),
    paymentStatus: 'paid',
    shippingStatus: 'delivered',
    sourceOrderStatus: 'COMPLETED',
    sourceShippingStatus: 'DELIVERED',
    sourceChannel: 'WEB',
    sourceOrigin: null,
    total: 5000,
    subtotal: 4500,
    discountAmount: 0,
    shippingFee: 500,
    taxAmount: 0,
    amountPaid: 5000,
    amountDue: 0,
    currency: 'NGN',
    orderDate: '2026-03-22T00:00:00Z',
    createdAt: '2026-03-22T00:00:00Z',
    updatedAt: null,
    couponCode: null,
    shippingOption: null,
    receiptReady: true,
    items: [
      {
        productId: 'p1',
        productName: 'Widget',
        sku: 'WDG-001',
        quantity: 1,
        unitPrice: 4500,
        lineTotal: 4500,
        matched: true,
        matchSource: 'sku',
      },
    ],
    importMetadata: {},
    ...overrides,
  };
}

function makeRow(
  overrides: Partial<ImportPreviewRow<NormalizedImportedOrder>> = {},
  orderOverrides: Partial<NormalizedImportedOrder> = {}
): ImportPreviewRow<NormalizedImportedOrder> {
  return {
    rowNumber: 1,
    sourceExternalId: '123',
    rowStatus: 'create',
    errors: [],
    payload: makeOrder(orderOverrides),
    meta: {},
    ...overrides,
  };
}

describe('buildBumpaOrderPreviewSummary', () => {
  it('returns zero counts for empty array', () => {
    const result = buildBumpaOrderPreviewSummary([]);
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(0);
  });

  it('counts total, valid, and invalid rows', () => {
    const rows = [
      makeRow({ rowStatus: 'create' }),
      makeRow({ rowStatus: 'update' }),
      makeRow({ rowStatus: 'invalid', payload: null }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(1);
  });

  it('counts create, update, and duplicate statuses', () => {
    const rows = [
      makeRow({ rowStatus: 'create' }),
      makeRow({ rowStatus: 'update' }),
      makeRow({ rowStatus: 'duplicate' }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.createCount).toBe(1);
    expect(result.updateCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('counts claimable customers (with email)', () => {
    const rows = [
      makeRow({}, { customer: makeCustomer({ email: 'a@b.com' }) }),
      makeRow({}, { customer: makeCustomer({ email: 'c@d.com' }) }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.claimableCustomers).toBe(2);
  });

  it('counts phone-only customers', () => {
    const rows = [
      makeRow({}, { customer: makeCustomer({ email: null, phone: '080' }) }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.phoneOnlyCustomers).toBe(1);
    expect(result.claimableCustomers).toBe(0);
  });

  it('counts anonymous customers (no email, no phone)', () => {
    const rows = [
      makeRow({}, { customer: makeCustomer({ email: null, phone: null }) }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.anonymousCustomers).toBe(1);
  });

  it('counts unmatched items across rows', () => {
    const rows = [
      makeRow(
        {},
        {
          items: [
            {
              productId: null,
              productName: 'X',
              sku: null,
              quantity: 1,
              unitPrice: 100,
              lineTotal: 100,
              matched: false,
              matchSource: 'unmatched',
            },
            {
              productId: 'p1',
              productName: 'Y',
              sku: 'Y1',
              quantity: 1,
              unitPrice: 200,
              lineTotal: 200,
              matched: true,
              matchSource: 'sku',
            },
          ],
        }
      ),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.unmatchedItems).toBe(1);
  });

  it('counts receipt-ready orders using payment status only', () => {
    const rows = [
      makeRow({}, { paymentStatus: 'paid', shippingStatus: 'delivered' }),
      makeRow({}, { paymentStatus: 'paid', shippingStatus: 'shipped' }),
      makeRow({}, { paymentStatus: 'paid', shippingStatus: 'pending' }),
      makeRow({}, { paymentStatus: 'unpaid', shippingStatus: 'delivered' }),
    ];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.receiptReadyOrders).toBe(3);
  });

  it('does not count customer or item stats for rows with null payload', () => {
    const rows = [makeRow({ rowStatus: 'invalid', payload: null })];
    const result = buildBumpaOrderPreviewSummary(rows);
    expect(result.claimableCustomers).toBe(0);
    expect(result.unmatchedItems).toBe(0);
    expect(result.receiptReadyOrders).toBe(0);
  });
});
