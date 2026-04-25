import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { syncJumiaOrdersForActiveIntegrations } from './jumia-order-sync.mjs';
import {
  createHappyPathSupabase,
  createMarketplaceSupabase,
} from './jumia-order-sync.test-helpers.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Jumia worker order sync', () => {
  it('returns an empty result when there are no active integrations', async () => {
    const supabase = createMarketplaceSupabase({ data: [], error: null });

    const result = await syncJumiaOrdersForActiveIntegrations({
      supabase,
      expo: {},
    });

    assert.deepEqual(result, {
      integrations: 0,
      synced: 0,
      canonicalCreated: 0,
      canonicalUpdated: 0,
      notified: 0,
      orderErrors: 0,
      errors: [],
    });
  });

  it('fails fast when active integrations cannot be loaded', async () => {
    const supabase = createMarketplaceSupabase({
      data: null,
      error: { message: 'database unavailable' },
    });

    await assert.rejects(
      syncJumiaOrdersForActiveIntegrations({ supabase, expo: {} }),
      /Failed to load Jumia integrations: database unavailable/
    );
  });

  it('creates a canonical order from an active integration', async () => {
    const integration = {
      id: 'integration-1',
      merchant_id: 'merchant-1',
      shop_id: 'shop-1',
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      token_expires_at: '2999-01-01T00:00:00.000Z',
      last_sync_at: null,
      sync_config: { orders: true },
    };
    const order = {
      id: 'order-1',
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
    const persistedOrder = {
      id: 'baci-order-1',
      external_id: 'order-1',
      tracking_token: 'tracking-token',
    };
    const writes = [];
    const supabase = createHappyPathSupabase({
      integration,
      persistedOrder,
      writes,
    });

    globalThis.fetch = (url, init) => {
      assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer access-1');
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/orders') {
        return Promise.resolve(
          Response.json({ orders: [order], isLastPage: true })
        );
      }
      if (parsedUrl.pathname === '/orders/items') {
        assert.equal(parsedUrl.searchParams.get('orderId'), 'order-1');
        return Promise.resolve(
          Response.json({
            items: [
              {
                id: 'item-1',
                product: {
                  name: 'Samsung Phone',
                  sellerSku: 'SKU-1',
                  imageUrl: 'https://example.com/phone.jpg',
                },
                status: 'ready_to_ship',
                itemPrice: 250000,
                paidPrice: 245000,
              },
            ],
          })
        );
      }
      throw new Error(`Unexpected Jumia URL: ${url}`);
    };

    const result = await syncJumiaOrdersForActiveIntegrations({
      supabase,
      expo: {},
    });

    assert.deepEqual(result, {
      integrations: 1,
      synced: 1,
      canonicalCreated: 1,
      canonicalUpdated: 0,
      notified: 0,
      orderErrors: 0,
      errors: [],
    });
    const ordersWrite = writes.find((write) => write.table === 'orders');
    assert.equal(ordersWrite.payload.external_id, 'order-1');
    assert.equal(ordersWrite.payload.order_number, 'JUMIA-12345');
    assert.equal(ordersWrite.payload.total, 250000);
    assert.equal(ordersWrite.payload.currency, 'NGN');
    assert.equal(ordersWrite.payload.customer_name, 'Ada Lovelace');

    const jumiaWrite = writes.find((write) => write.table === 'jumia_orders');
    assert.equal(jumiaWrite.payload.jumia_order_id, 'order-1');
    assert.equal(jumiaWrite.payload.baci_order_id, 'baci-order-1');

    const syncCursorWrite = writes.find(
      (write) => write.table === 'marketplace_integrations'
    );
    assert.equal(syncCursorWrite.payload.sync_error, null);
    supabase.assertQueuesEmpty();
  });

  it('records per-order errors without advancing the cursor when item fetch fails', async () => {
    const integration = {
      id: 'integration-1',
      merchant_id: 'merchant-1',
      shop_id: 'shop-1',
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      token_expires_at: '2999-01-01T00:00:00.000Z',
      last_sync_at: null,
      sync_config: { orders: true },
    };
    const order = {
      id: 'order-1',
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
    const writes = [];
    const supabase = createHappyPathSupabase({
      integration,
      persistedOrder: {
        id: 'baci-order-1',
        external_id: 'order-1',
        tracking_token: 'tracking-token',
      },
      writes,
    });

    globalThis.fetch = (url, init) => {
      assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer access-1');
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/orders') {
        return Promise.resolve(
          Response.json({ orders: [order], isLastPage: true })
        );
      }
      if (parsedUrl.pathname === '/orders/items') {
        return Promise.resolve(
          Response.json({ error: 'Jumia unavailable' }, { status: 503 })
        );
      }
      throw new Error(`Unexpected Jumia URL: ${url}`);
    };

    const result = await syncJumiaOrdersForActiveIntegrations({
      supabase,
      expo: {},
    });

    assert.equal(result.orderErrors, 1);
    assert.equal(result.synced, 0);
    assert.match(result.errors.join('\n'), /merchant-1\/order-1/);
    const syncCursorWrite = writes.find(
      (write) => write.table === 'marketplace_integrations'
    );
    assert.equal(syncCursorWrite.payload.last_sync_at, undefined);
    assert.match(syncCursorWrite.payload.sync_error, /cursor not advanced/);
    // This failure path intentionally stops before canonical writes, so the
    // happy-path mock keeps its later write queues unused.
  });
});
