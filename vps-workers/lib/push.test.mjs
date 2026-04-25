import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createExpoClient, notifyMerchant } from './push.mjs';

const originalExpoAccessToken = process.env.EXPO_ACCESS_TOKEN;

afterEach(() => {
  if (originalExpoAccessToken === undefined) {
    delete process.env.EXPO_ACCESS_TOKEN;
  } else {
    process.env.EXPO_ACCESS_TOKEN = originalExpoAccessToken;
  }
});

function createNoTokenSupabase() {
  const attempts = [];
  const expectedEqCalls = [
    ['merchant_id', 'merchant-1'],
    ['is_active', true],
    ['app_type', 'admin'],
  ];
  const pushTokenQuery = {
    select() {
      return this;
    },
    eq(column, value) {
      assert.deepEqual([column, value], expectedEqCalls.shift());
      return expectedEqCalls.length === 0
        ? Promise.resolve({ data: [], error: null })
        : this;
    },
    assertFullyConsumed() {
      assert.equal(expectedEqCalls.length, 0);
    },
  };
  const attemptQuery = {
    insert(payload) {
      attempts.push(payload);
      return Promise.resolve({ error: null });
    },
  };

  return {
    attempts,
    pushTokenQuery,
    from(table) {
      if (table === 'push_tokens') return pushTokenQuery;
      if (table === 'push_notification_attempts') return attemptQuery;
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe('push worker helpers', () => {
  it('requires an Expo access token before constructing the Expo client', () => {
    delete process.env.EXPO_ACCESS_TOKEN;

    assert.throws(() => createExpoClient(), /EXPO_ACCESS_TOKEN is required/);
  });

  it('records skipped push attempts when a merchant has no active tokens', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'test-token';
    const supabase = createNoTokenSupabase();

    const result = await notifyMerchant({
      supabase,
      // Intentionally unused: no active tokens means Expo is never called here.
      expo: {},
      merchantId: 'merchant-1',
      title: 'Low Stock Alert',
      body: 'Phone Case is low on stock',
      data: { type: 'low_stock' },
      channelId: 'stock',
    });

    assert.deepEqual(result, { sent: 0, failed: 0, errors: [] });
    supabase.pushTokenQuery.assertFullyConsumed();
    assert.equal(supabase.attempts.length, 1);
    assert.deepEqual(supabase.attempts[0], {
      merchant_id: 'merchant-1',
      user_id: null,
      app_type: 'admin',
      channel: 'stock',
      notification_type: 'low_stock',
      title: 'Low Stock Alert',
      body: 'Phone Case is low on stock',
      payload: { type: 'low_stock' },
      token_count: 0,
      sent_count: 0,
      failed_count: 0,
      status: 'skipped_no_tokens',
      errors: [],
    });
  });
});
