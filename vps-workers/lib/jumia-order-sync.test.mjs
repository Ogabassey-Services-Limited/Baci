import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { syncJumiaOrdersForActiveIntegrations } from './jumia-order-sync.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createMarketplaceSupabase(response) {
  const updates = [];
  const expectedEqCalls = [
    ['platform', 'jumia'],
    ['is_active', true],
  ];
  return {
    updates,
    from(table) {
      assert.equal(table, 'marketplace_integrations');
      return {
        select() {
          return this;
        },
        eq(column, value) {
          const expected = expectedEqCalls.shift();
          assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
          assert.deepEqual([column, value], expected);
          return expectedEqCalls.length === 0
            ? Promise.resolve(response)
            : this;
        },
        update(payload) {
          updates.push(payload);
          return this;
        },
      };
    },
  };
}

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
});

function createHappyPathSupabase({ integration, persistedOrder, writes }) {
  const queues = {
    marketplace_integrations: [
      createSelectQuery({
        eqs: [
          ['platform', 'jumia'],
          ['is_active', true],
        ],
        response: { data: [integration], error: null },
      }),
      createUpdateQuery({
        table: 'marketplace_integrations',
        writes,
        eqs: [['id', integration.id]],
      }),
    ],
    jumia_orders: [
      createSelectQuery({
        eqs: [['merchant_id', integration.merchant_id]],
        inCall: ['jumia_order_id', ['order-1']],
        response: { data: [], error: null },
      }),
      createUpsertQuery({ table: 'jumia_orders', writes }),
    ],
    orders: [
      createSelectQuery({
        eqs: [
          ['merchant_id', integration.merchant_id],
          ['external_source', 'jumia'],
        ],
        inCall: ['external_id', ['order-1']],
        response: { data: [], error: null },
      }),
      createInsertQuery({
        table: 'orders',
        writes,
        response: { data: persistedOrder, error: null },
        requiresSingle: true,
      }),
    ],
    order_items: [
      createDeleteQuery({
        eqs: [['order_id', persistedOrder.id]],
      }),
      createInsertQuery({
        table: 'order_items',
        writes,
        response: { error: null },
      }),
    ],
    push_tokens: [
      createSelectQuery({
        eqs: [
          ['merchant_id', integration.merchant_id],
          ['is_active', true],
          ['app_type', 'admin'],
        ],
        response: { data: [], error: null },
      }),
    ],
    push_notification_attempts: [
      createInsertQuery({
        table: 'push_notification_attempts',
        writes,
        response: { error: null },
      }),
    ],
  };

  return {
    from(table) {
      const query = queues[table]?.shift();
      assert.ok(query, `Unexpected table query: ${table}`);
      return query;
    },
    assertQueuesEmpty() {
      for (const [table, remaining] of Object.entries(queues)) {
        assert.equal(remaining.length, 0, `Unconsumed ${table} queries`);
      }
    },
  };
}

function createSelectQuery({ eqs = [], inCall, response }) {
  return {
    select() {
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return eqs.length === 0 && !inCall ? Promise.resolve(response) : this;
    },
    in(column, values) {
      assert.deepEqual([column, values], inCall);
      return Promise.resolve(response);
    },
  };
}

function createInsertQuery({
  table,
  writes,
  response,
  requiresSingle = false,
}) {
  return {
    insert(payload) {
      writes.push({ table, operation: 'insert', payload });
      return requiresSingle ? this : Promise.resolve(response);
    },
    select() {
      return this;
    },
    single() {
      return Promise.resolve(response);
    },
  };
}

function createUpdateQuery({ table, writes, eqs }) {
  return {
    update(payload) {
      writes.push({ table, operation: 'update', payload });
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return Promise.resolve({ error: null });
    },
  };
}

function createUpsertQuery({ table, writes }) {
  return {
    upsert(payload) {
      writes.push({ table, operation: 'upsert', payload });
      return Promise.resolve({ error: null });
    },
  };
}

function createDeleteQuery({ eqs }) {
  return {
    delete() {
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return Promise.resolve({ error: null });
    },
  };
}
