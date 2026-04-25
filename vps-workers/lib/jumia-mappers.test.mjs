import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCanonicalJumiaOrderPayload,
  buildJumiaCacheRow,
  buildJumiaOrderNumber,
  buildOrderItems,
  getJumiaSyncLowerBound,
  readOrderSyncEnabled,
} from './jumia-mappers.mjs';

const integration = {
  id: 'integration-1',
  merchant_id: 'merchant-1',
  shop_id: 'shop-1',
  last_sync_at: null,
  sync_config: { orders: true },
};

const order = {
  id: 'JUMIA/ORDER 1',
  number: '12345',
  status: 'ready_to_ship',
  totalAmount: { currency: 'NGN', value: 250000 },
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
};

const item = {
  id: 'item-1',
  product: {
    name: 'Samsung Phone',
    sellerSku: 'SKU-1',
    imageUrl: 'https://example.com/phone.jpg',
  },
  status: 'ready_to_ship',
  itemPrice: 250000,
  paidPrice: 245000,
};

describe('Jumia worker mappers', () => {
  it('respects order sync config', () => {
    assert.equal(readOrderSyncEnabled(null), true);
    assert.equal(readOrderSyncEnabled({ orders: true }), true);
    assert.equal(readOrderSyncEnabled({ orders: false }), false);
  });

  it('builds sync lower bounds from fallback and overlap windows', () => {
    const beforeFallback = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const fallback = new Date(getJumiaSyncLowerBound(null)).getTime();
    const afterFallback = Date.now() - 7 * 24 * 60 * 60 * 1000;

    assert.ok(fallback >= beforeFallback - 1_000);
    assert.ok(fallback <= afterFallback + 1_000);
    assert.equal(
      getJumiaSyncLowerBound('2026-04-25T11:30:00.000Z'),
      '2026-04-25T11:20:00.000Z'
    );
  });

  it('builds canonical Baci order payloads from Jumia orders', () => {
    const payload = buildCanonicalJumiaOrderPayload(
      integration,
      order,
      'tracking-token'
    );

    assert.equal(payload.merchant_id, 'merchant-1');
    assert.equal(payload.order_number, 'JUMIA-12345');
    assert.equal(payload.customer_name, 'Ada Lovelace');
    assert.equal(
      payload.customer_email,
      'jumia-jumia-order-1@marketplace.usebaci.local'
    );
    assert.equal(payload.shipping_status, 'shipped');
    assert.equal(payload.external_source, 'jumia');
    assert.equal(payload.external_id, 'JUMIA/ORDER 1');
    assert.equal(payload.tracking_token, 'tracking-token');
  });

  it('builds cache rows without dropping notification state', () => {
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
    assert.equal(cacheRow.notification_sent, true);
    assert.equal(cacheRow.baci_order_id, 'baci-order-id');
    assert.equal(cacheRow.items.length, 1);
  });

  it('builds order items with the paid price and seller SKU', () => {
    const orderItems = buildOrderItems('baci-order-id', [item]);
    const [orderItem] = orderItems;

    assert.equal(orderItem.order_id, 'baci-order-id');
    assert.equal(orderItem.name, 'Samsung Phone');
    assert.equal(orderItem.price, 245000);
    assert.equal(orderItem.quantity, 1);
    assert.equal(orderItem.sellers_item_id, 'SKU-1');
  });

  it('keeps canonical Jumia order numbers unchanged', () => {
    assert.equal(buildJumiaOrderNumber('JUMIA-12345'), 'JUMIA-12345');
  });

  it('transforms non-canonical order numbers to canonical format', () => {
    assert.equal(buildJumiaOrderNumber('12345'), 'JUMIA-12345');
  });
});
