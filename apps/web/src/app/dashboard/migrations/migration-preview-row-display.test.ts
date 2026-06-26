import { describe, expect, it } from 'vitest';
import {
  getMigrationRowPrimaryText,
  getMigrationRowRecordText,
  getMigrationRowSecondaryText,
  getMigrationRowSourceDetails,
} from '@/app/dashboard/migrations/migration-preview-row-display';
import type { ImportJobRowsResponse } from '@/app/dashboard/migrations/migration-types';
import type {
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';

type MigrationPreviewRow = ImportJobRowsResponse['rows'][number];

function createOrderPayload(
  overrides: Partial<NormalizedImportedOrder> = {}
): NormalizedImportedOrder {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'bumpa-order-1',
    orderNumber: 'ORD-1001',
    customer: {
      claimable: true,
      email: 'ada@example.com',
      firstName: 'Ada',
      fullName: 'Ada Lovelace',
      lastName: 'Lovelace',
      phone: '+2348000000000',
    },
    paymentStatus: 'paid',
    shippingStatus: 'pending',
    sourceOrderStatus: 'pending',
    sourceShippingStatus: null,
    sourceChannel: 'MOBILE',
    sourceOrigin: 'instagram',
    total: 25000,
    subtotal: 25000,
    discountAmount: 0,
    shippingFee: 0,
    taxAmount: 0,
    amountPaid: 25000,
    amountDue: 0,
    currency: 'NGN',
    orderDate: '2026-03-23T00:00:00.000Z',
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: null,
    couponCode: null,
    shippingOption: null,
    shippingAddress: null,
    receiptReady: false,
    items: [
      {
        lineTotal: 25000,
        matched: true,
        matchSource: 'name',
        productId: 'prod_1',
        productName: 'Widget',
        quantity: 1,
        sku: 'WID-1',
        unitPrice: 25000,
      },
    ],
    importMetadata: {},
    ...overrides,
  };
}

function createProductPayload(
  overrides: Partial<NormalizedImportedProduct> = {}
): NormalizedImportedProduct {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'bumpa-product-1',
    title: 'Laptop Sleeve',
    description: null,
    sku: 'LAP-1',
    price: 9000,
    currency: 'NGN',
    stock: 5,
    manageStock: true,
    status: 'active',
    images: [],
    category: null,
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    importMetadata: {},
    ...overrides,
  };
}

function createRow(
  overrides: Partial<MigrationPreviewRow> = {}
): MigrationPreviewRow {
  return {
    id: 'row-1',
    meta: {},
    normalized_payload: null,
    row_number: 12,
    row_status: 'invalid',
    source_external_id: null,
    source_payload: {},
    validation_errors: [],
    ...overrides,
  };
}

describe('migration-preview-row-display', () => {
  it('returns record text for orders from normalized payload and fallback source payload', () => {
    expect(
      getMigrationRowRecordText(
        'orders',
        createRow({
          normalized_payload: createOrderPayload(),
        })
      )
    ).toBe('ORD-1001');

    expect(
      getMigrationRowRecordText(
        'orders',
        createRow({
          normalized_payload: createOrderPayload({ orderNumber: '' }),
          row_number: 18,
        })
      )
    ).toBe('CSV Row 18');

    expect(
      getMigrationRowRecordText(
        'orders',
        createRow({
          source_payload: { 'Order Number': '05492' },
        })
      )
    ).toBe('05492');

    expect(
      getMigrationRowRecordText('orders', createRow({ row_number: 99 }))
    ).toBe('CSV Row 99');
  });

  it('returns record text for products across normalized and fallback branches', () => {
    expect(
      getMigrationRowRecordText(
        'products',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBe('Laptop Sleeve');

    expect(
      getMigrationRowRecordText(
        'products',
        createRow({
          normalized_payload: createProductPayload({
            title: '',
            sku: 'SKU-22',
          }),
        })
      )
    ).toBe('SKU-22');

    expect(
      getMigrationRowRecordText(
        'products',
        createRow({
          normalized_payload: createOrderPayload(),
          row_number: 33,
        })
      )
    ).toBe('CSV Row 33');

    expect(
      getMigrationRowRecordText(
        'products',
        createRow({
          source_payload: { Products: 'AirPods Max' },
        })
      )
    ).toBe('AirPods Max');
  });

  it('returns primary text for orders and products across fallback and normalized paths', () => {
    expect(
      getMigrationRowPrimaryText(
        'orders',
        createRow({
          source_payload: { 'Customer Name': 'Shyft Power' },
        })
      )
    ).toBe('Shyft Power');

    expect(getMigrationRowPrimaryText('orders', createRow())).toBe(
      'Validation errors require review'
    );

    expect(
      getMigrationRowPrimaryText(
        'orders',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBe('Unknown customer');

    expect(
      getMigrationRowPrimaryText(
        'orders',
        createRow({
          normalized_payload: createOrderPayload({
            customer: {
              ...createOrderPayload().customer,
              fullName: '',
            },
          }),
        })
      )
    ).toBe('Unknown customer');

    expect(
      getMigrationRowPrimaryText(
        'products',
        createRow({
          source_payload: { Products: 'JBL Live 660' },
        })
      )
    ).toBe('JBL Live 660');

    expect(getMigrationRowPrimaryText('products', createRow())).toBe(
      'Validation errors require review'
    );

    expect(
      getMigrationRowPrimaryText(
        'products',
        createRow({
          normalized_payload: createOrderPayload(),
        })
      )
    ).toBe('Untitled product');

    expect(
      getMigrationRowPrimaryText(
        'products',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBe('Laptop Sleeve · LAP-1');

    expect(
      getMigrationRowPrimaryText(
        'products',
        createRow({
          normalized_payload: createProductPayload({ title: '', sku: null }),
        })
      )
    ).toBe('Untitled product');
  });

  it('returns secondary text for order and product rows across success and fallback states', () => {
    expect(
      getMigrationRowSecondaryText(
        'orders',
        createRow({
          source_payload: {
            Total: '3661200.00',
            'Customer Email': 'sales@shyft.africa',
          },
        })
      )
    ).toBe('3661200.00 NGN · sales@shyft.africa');

    expect(
      getMigrationRowSecondaryText(
        'orders',
        createRow({
          source_payload: { 'Customer Phone': '09070313079' },
        })
      )
    ).toBe('09070313079');

    expect(getMigrationRowSecondaryText('orders', createRow())).toBe(
      'Validation errors require review'
    );

    expect(
      getMigrationRowSecondaryText(
        'orders',
        createRow({
          meta: { unmatchedItemCount: 2 },
          normalized_payload: createOrderPayload({
            items: [
              createOrderPayload().items[0],
              {
                ...createOrderPayload().items[0],
                productId: null,
                productName: 'Keyboard',
                quantity: 2,
              },
            ],
            total: 42000,
          }),
        })
      )
    ).toBe('42000 NGN · 2 items · 2 unmatched');

    expect(
      getMigrationRowSecondaryText(
        'orders',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBe('Validation errors require review');

    expect(
      getMigrationRowSecondaryText(
        'products',
        createRow({
          normalized_payload: createOrderPayload(),
        })
      )
    ).toBe('Validation errors require review');

    expect(
      getMigrationRowSecondaryText(
        'products',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBe('9000 NGN · active');

    expect(
      getMigrationRowSecondaryText(
        'products',
        createRow({
          normalized_payload: createProductPayload({
            price: 0,
            currency: '',
            status: undefined as unknown as 'active' | 'draft',
          }),
        })
      )
    ).toBe('0 NGN · draft');
  });

  it('returns source details only for order rows when channel or origin exist', () => {
    expect(
      getMigrationRowSourceDetails(
        'orders',
        createRow({
          normalized_payload: createOrderPayload({
            sourceChannel: 'MOBILE',
            sourceOrigin: 'instagram',
          }),
        })
      )
    ).toEqual({
      sourceChannel: 'MOBILE',
      sourceOrigin: 'instagram',
    });

    expect(
      getMigrationRowSourceDetails(
        'orders',
        createRow({
          source_payload: {
            Channel: 'MOBILE',
            Origin: 'whatsapp',
          },
        })
      )
    ).toEqual({
      sourceChannel: 'MOBILE',
      sourceOrigin: 'whatsapp',
    });

    expect(
      getMigrationRowSourceDetails(
        'orders',
        createRow({
          source_payload: {},
        })
      )
    ).toBeNull();

    expect(
      getMigrationRowSourceDetails(
        'orders',
        createRow({
          normalized_payload: createOrderPayload({
            sourceChannel: null,
            sourceOrigin: null,
          }),
        })
      )
    ).toBeNull();

    expect(
      getMigrationRowSourceDetails(
        'products',
        createRow({
          normalized_payload: createProductPayload(),
        })
      )
    ).toBeNull();
  });
});
