import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupOrders } from './cleanup-orders.mjs';

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

function createClientMock({ error = null } = {}) {
  const calls = [];
  const createSupabaseClient = (url, key, options) => {
    calls.push({ key, options, url });
    return {
      rpc(name, params) {
        calls.push({ name, operation: 'rpc', params });
        return Promise.resolve({ error });
      },
    };
  };

  return { calls, createSupabaseClient };
}

describe('cleanupOrders', () => {
  it('marks abandoned orders older than the default threshold', async () => {
    const mock = createClientMock();
    const messages = [];

    const result = await cleanupOrders({
      createSupabaseClient: mock.createSupabaseClient,
      env: requiredEnv,
      logger: { log: (message) => messages.push(message) },
    });

    assert.deepEqual(result, { hoursThreshold: 72 });
    assert.deepEqual(mock.calls, [
      {
        key: 'service-key',
        options: { auth: { persistSession: false } },
        url: 'https://project.supabase.co',
      },
      {
        name: 'mark_abandoned_orders',
        operation: 'rpc',
        params: { hours_threshold: 72 },
      },
    ]);
    assert.match(messages[0], /older than 72 hours/);
  });

  it('uses a configured threshold when it is a positive integer', async () => {
    const mock = createClientMock();

    const result = await cleanupOrders({
      createSupabaseClient: mock.createSupabaseClient,
      env: {
        ...requiredEnv,
        CLEANUP_ORDERS_HOURS_THRESHOLD: '48',
      },
      logger: { log: () => undefined },
    });

    assert.deepEqual(result, { hoursThreshold: 48 });
    assert.deepEqual(mock.calls[1], {
      name: 'mark_abandoned_orders',
      operation: 'rpc',
      params: { hours_threshold: 48 },
    });
  });

  it('fails closed when worker database credentials are missing', async () => {
    const mock = createClientMock();

    await assert.rejects(
      cleanupOrders({
        createSupabaseClient: mock.createSupabaseClient,
        env: {},
      }),
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/
    );
    assert.equal(mock.calls.length, 0);
  });

  it('reports RPC failures to the scheduler', async () => {
    const mock = createClientMock({
      error: { message: 'database unavailable' },
    });

    await assert.rejects(
      cleanupOrders({
        createSupabaseClient: mock.createSupabaseClient,
        env: requiredEnv,
      }),
      /database unavailable/
    );
  });
});
