import { describe, expect, it } from 'vitest';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import {
  buildOrderInsertPayload,
  buildOrderItems,
  getPreviewExistingOrderUpdatedAt,
} from './commit-bumpa-order-payload';

function createOrder(
  overrides: Partial<NormalizedImportedOrder> = {}
): NormalizedImportedOrder {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'ext-1',
    orderNumber: 'ORD-1001',
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2347000000000',
      claimable: true,
    },
    shippingStatus: 'delivered',
    paymentStatus: 'paid',
    sourceOrderStatus: 'fulfilled',
    sourceShippingStatus: 'delivered',
    total: 25000,
    subtotal: 24000,
    shippingFee: 1000,
    taxAmount: 0,
    discountAmount: 0,
    amountPaid: 25000,
    amountDue: 0,
    currency: 'NGN',
    orderDate: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-21T10:00:00.000Z',
    couponCode: null,
    shippingOption: 'Door delivery',
    shippingAddress: null,
    sourceChannel: 'instagram',
    sourceOrigin: 'manual',
    receiptReady: true,
    importMetadata: {
      previewExistingOrderUpdatedAt: '2026-03-21T10:00:00.000Z',
      source: 'preview',
    },
    items: [
      {
        productId: 'product-1',
        productName: 'Imported Phone',
        sku: 'SKU-1',
        quantity: 2,
        unitPrice: 12500,
        lineTotal: 25000,
        matched: true,
        matchSource: 'sku',
      },
    ],
    ...overrides,
  };
}

describe('Bumpa commit payload helpers', () => {
  it('builds order payloads without persisting preview concurrency metadata', () => {
    const payload = buildOrderInsertPayload(
      'merchant-1',
      'job-1',
      'customer-1',
      createOrder({
        shippingAddress: {
          fullAddress: '12 Admiralty Way, Lekki',
          address: null,
          city: 'Lekki',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: null,
          source: 'bumpa-rich-export',
        },
      }),
      'tracking-1'
    );

    expect(payload.shipping_address).toMatchObject({
      address: '12 Admiralty Way, Lekki',
      address_line1: '12 Admiralty Way, Lekki',
      city: 'Lekki',
      state: 'Lagos',
    });
    expect(payload.fulfillment_details).toMatchObject({
      shipping_address_source: 'bumpa-rich-export',
    });
    expect(payload.payment_method).toBe('bank_transfer');
    expect(payload.import_metadata).toEqual({ source: 'preview' });
  });

  it('builds ordered item payloads with top-level fulfillment identifiers', () => {
    const [item] = buildOrderItems(
      'order-1',
      createOrder({
        items: [
          {
            productId: null,
            productName: 'iPhone 12',
            sku: null,
            quantity: 1,
            unitPrice: 300000,
            lineTotal: 300000,
            condition: 'used',
            variantName: 'Used',
            imageUrl: 'https://cdn.example.com/iphone-12.jpg',
            matched: false,
            matchSource: 'unmatched',
            importMetadata: {
              bumpa: {
                fulfillment_identifiers: {
                  imeis: ['351183326811261'],
                  serialNumbers: ['ABC123'],
                },
              },
            },
          },
        ],
      })
    );

    expect(item).toMatchObject({
      order_id: 'order-1',
      line_id: 1,
      line_extension_amount: 300000,
      condition: 'used',
      variant_name: 'Used',
      image_url: 'https://cdn.example.com/iphone-12.jpg',
      fulfillment_data: {
        imei: '351183326811261',
        serialNumber: 'ABC123',
        serial_number: 'ABC123',
      },
    });
  });

  it('reads the preview-time updated_at value used for stale checks', () => {
    expect(getPreviewExistingOrderUpdatedAt(createOrder())).toBe(
      '2026-03-21T10:00:00.000Z'
    );
  });
});
