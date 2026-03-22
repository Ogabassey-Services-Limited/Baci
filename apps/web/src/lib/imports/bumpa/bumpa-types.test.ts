import { describe, expectTypeOf, it } from 'vitest';
import type {
  ExistingImportedCustomer,
  ExistingImportedOrder,
  ExistingImportedProduct,
  ImportPreviewRow,
  ImportPreviewRowStatus,
  ImportPreviewSummary,
  NormalizedImportedCustomer,
  NormalizedImportedOrder,
  NormalizedImportedOrderItem,
  NormalizedImportedProduct,
} from './bumpa-types';

describe('bumpa-types', () => {
  it('ImportPreviewRowStatus includes expected values', () => {
    const statuses: ImportPreviewRowStatus[] = [
      'create',
      'update',
      'duplicate',
      'invalid',
    ];
    expectTypeOf(statuses).toEqualTypeOf<ImportPreviewRowStatus[]>();
  });

  it('ImportPreviewSummary has all 11 counter fields', () => {
    const summary: ImportPreviewSummary = {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      createCount: 0,
      updateCount: 0,
      duplicateCount: 0,
      claimableCustomers: 0,
      phoneOnlyCustomers: 0,
      anonymousCustomers: 0,
      unmatchedItems: 0,
      receiptReadyOrders: 0,
    };
    expectTypeOf(summary).toMatchTypeOf<ImportPreviewSummary>();
  });

  it('NormalizedImportedCustomer requires claimable flag', () => {
    const customer: NormalizedImportedCustomer = {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: null,
      claimable: true,
    };
    expectTypeOf(customer).toMatchTypeOf<NormalizedImportedCustomer>();
  });

  it('NormalizedImportedOrderItem matchSource is a union', () => {
    const sources: NormalizedImportedOrderItem['matchSource'][] = [
      'sku',
      'name',
      'unmatched',
    ];
    expectTypeOf(sources).toEqualTypeOf<
      NormalizedImportedOrderItem['matchSource'][]
    >();
  });

  it('NormalizedImportedOrder has sourcePlatform bumpa', () => {
    expectTypeOf<
      NormalizedImportedOrder['sourcePlatform']
    >().toEqualTypeOf<'bumpa'>();
  });

  it('NormalizedImportedProduct status is active or draft', () => {
    const statuses: NormalizedImportedProduct['status'][] = ['active', 'draft'];
    expectTypeOf(statuses).toEqualTypeOf<
      NormalizedImportedProduct['status'][]
    >();
  });

  it('ImportPreviewRow is generic over payload', () => {
    const row: ImportPreviewRow<NormalizedImportedOrder> = {
      rowNumber: 1,
      sourceExternalId: '123',
      rowStatus: 'create',
      errors: [],
      payload: null,
      meta: {},
    };
    expectTypeOf(row.payload).toEqualTypeOf<NormalizedImportedOrder | null>();
  });

  it('ExistingImportedOrder has nullable external fields', () => {
    const order: ExistingImportedOrder = {
      id: '1',
      orderNumber: 'ORD-001',
      externalSource: null,
      externalId: null,
    };
    expectTypeOf(order.externalSource).toEqualTypeOf<string | null>();
  });

  it('ExistingImportedProduct has nullable sku and price', () => {
    const product: ExistingImportedProduct = {
      id: '1',
      name: 'Test',
      sku: null,
      price: null,
      externalSource: null,
      externalId: null,
    };
    expectTypeOf(product.sku).toEqualTypeOf<string | null>();
    expectTypeOf(product.price).toEqualTypeOf<number | null>();
  });

  it('ExistingImportedCustomer has nullable userId', () => {
    const customer: ExistingImportedCustomer = {
      id: '1',
      email: null,
      phone: null,
      userId: null,
    };
    expectTypeOf(customer.userId).toEqualTypeOf<string | null>();
  });
});
