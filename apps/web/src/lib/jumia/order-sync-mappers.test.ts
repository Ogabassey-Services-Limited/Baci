import { describe, expect, it } from 'vitest';
import type { JumiaOrder, JumiaOrderItem } from '@/schemas/jumia';
import {
  buildCanonicalJumiaOrderPayload,
  buildJumiaCacheRow,
  buildJumiaOrderNumber,
  buildOrderItems,
  getJumiaSyncLowerBound,
  type MarketplaceIntegrationRow,
  mapJumiaShippingStatus,
  readOrderSyncEnabled,
} from './order-sync-mappers';

const integration: MarketplaceIntegrationRow = {
  id: 'integration-1',
  merchant_id: 'merchant-1',
  shop_id: 'shop-1',
  last_sync_at: null,
  sync_config: { orders: true },
};

const order: JumiaOrder = {
  id: 'JUMIA/ORDER 1',
  shopIds: ['shop-1'],
  totalItems: 1,
  packedItems: 0,
  isPrepayment: true,
  hasMultipleStatus: false,
  hasItemsFulfilledByJumia: false,
  pendingSince: '2026-04-25T08:00:00.000Z',
  status: 'ready_to_ship',
  deliveryOption: 'standard',
  number: '12345',
  totalAmount: { currency: 'NGN', value: 250000 },
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  shippingAddress: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    address: '10 Jumia Road',
    city: 'Lagos',
    postalCode: '100001',
    ward: 'Ikeja',
    region: 'Lagos',
    countryName: 'Nigeria',
  },
  createdAt: '2026-04-25T08:01:00.000Z',
  updatedAt: '2026-04-25T08:02:00.000Z',
  totalAmountLocal: { currency: 'NGN', value: 250000 },
};

const item: JumiaOrderItem = {
  id: 'item-1',
  shopId: 'shop-1',
  product: {
    name: 'Samsung Phone',
    sellerSku: 'SKU-1',
    imageUrl: 'https://example.com/phone.jpg',
  },
  status: 'ready_to_ship',
  trackingNumber: '',
  trackingUrl: '',
  shipmentType: 'standard',
  deliveryOption: 'standard',
  isFulfilledByJumia: false,
  itemPrice: 250000,
  paidPrice: 245000,
  shippingAmount: 0,
  itemPriceLocal: 250000,
  paidPriceLocal: 245000,
  shippingAmountLocal: 0,
  exchangeRate: 1,
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  taxAmount: 0,
  voucherAmount: 5000,
  shippingAddress: order.shippingAddress,
};

describe('Jumia order sync mappers', () => {
  it('maps Jumia statuses to canonical shipping statuses', () => {
    expect(mapJumiaShippingStatus('delivered')).toBe('delivered');
    expect(mapJumiaShippingStatus('ready_to_ship')).toBe('shipped');
    expect(mapJumiaShippingStatus('packed')).toBe('processing');
    expect(mapJumiaShippingStatus('canceled')).toBe('cancelled');
    expect(mapJumiaShippingStatus('ready_to_cancel')).toBe('cancelled');
    expect(mapJumiaShippingStatus('returned')).toBe('returned');
    expect(mapJumiaShippingStatus('pending')).toBe('pending');
    expect(mapJumiaShippingStatus('unknown_status')).toBe('pending');
  });

  it('respects integration order sync config', () => {
    expect(readOrderSyncEnabled(null)).toBe(true);
    expect(readOrderSyncEnabled({ orders: true })).toBe(true);
    expect(readOrderSyncEnabled({ orders: false })).toBe(false);
  });

  it('uses a fallback lookback and overlap for sync cursors', () => {
    const now = new Date('2026-04-25T12:00:00.000Z').getTime();

    expect(getJumiaSyncLowerBound(null, now)).toBe('2026-04-18T12:00:00.000Z');
    expect(getJumiaSyncLowerBound('not-a-date', now)).toBe(
      '2026-04-18T12:00:00.000Z'
    );
    expect(getJumiaSyncLowerBound('2026-04-25T11:30:00.000Z', now)).toBe(
      '2026-04-25T11:20:00.000Z'
    );
  });

  it('builds canonical Baci order payloads from Jumia orders', () => {
    const payload = buildCanonicalJumiaOrderPayload(
      integration,
      order,
      'tracking-token'
    );

    expect(payload).toMatchObject({
      merchant_id: 'merchant-1',
      order_number: 'JUMIA-12345',
      customer_name: 'Ada Lovelace',
      customer_email: 'jumia-jumia-order-1@marketplace.usebaci.local',
      shipping_status: 'shipped',
      payment_status: 'paid',
      source: 'jumia',
      external_source: 'jumia',
      external_id: 'JUMIA/ORDER 1',
      tracking_token: 'tracking-token',
    });
  });

  it('builds cache rows and order items without dropping notification state', () => {
    const cacheRow = buildJumiaCacheRow(
      integration,
      order,
      [item],
      {
        jumia_order_id: order.id,
        notification_sent: true,
        baci_order_id: 'old-order-id',
      },
      'baci-order-id'
    );
    const orderItems = buildOrderItems('baci-order-id', [item]);

    expect(cacheRow.notification_sent).toBe(true);
    expect(cacheRow.baci_order_id).toBe('baci-order-id');
    expect(cacheRow.items).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      order_id: 'baci-order-id',
      name: 'Samsung Phone',
      price: 245000,
      quantity: 1,
      sellers_item_id: 'SKU-1',
    });
  });

  it('keeps canonical Jumia order numbers unchanged', () => {
    expect(buildJumiaOrderNumber('JUMIA-12345')).toBe('JUMIA-12345');
  });

  it('handles empty item lists without dropping notification state', () => {
    const cacheRow = buildJumiaCacheRow(
      integration,
      order,
      [],
      {
        jumia_order_id: order.id,
        notification_sent: true,
        baci_order_id: 'old-order-id',
      },
      'baci-order-id'
    );

    expect(buildOrderItems('baci-order-id', [])).toHaveLength(0);
    expect(cacheRow.notification_sent).toBe(true);
    expect(cacheRow.baci_order_id).toBe('baci-order-id');
    expect(cacheRow.items).toHaveLength(0);
  });
});
