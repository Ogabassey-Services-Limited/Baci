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

function createTokenSupabase({ ticketInsertError = null } = {}) {
  const attempts = [];
  const ticketRows = [];
  const tokenUpdates = [];
  const expectedEqCalls = [
    ['merchant_id', 'merchant-1'],
    ['is_active', true],
    ['app_type', 'admin'],
  ];
  const selectQuery = {
    eq(column, value) {
      assert.deepEqual([column, value], expectedEqCalls.shift());
      return expectedEqCalls.length === 0
        ? Promise.resolve({
            data: [
              { token: 'ExpoPushToken[aaaaaaaaaaaaaaaaaaaaaa]' },
              { token: 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]' },
            ],
            error: null,
          })
        : this;
    },
  };
  const updateQuery = {
    eq(column, value) {
      const lastUpdate = tokenUpdates.at(-1);
      if (!lastUpdate) {
        throw new Error('tokenUpdates must have an entry before calling eq()');
      }
      lastUpdate.filters.push([column, value]);
      return this;
    },
    in(column, values) {
      const lastUpdate = tokenUpdates.at(-1);
      if (!lastUpdate) {
        throw new Error('tokenUpdates must have an entry before calling in()');
      }
      lastUpdate.filters.push([column, values]);
      return Promise.resolve({ error: null });
    },
  };
  const pushTokenQuery = {
    select() {
      return selectQuery;
    },
    update(payload) {
      tokenUpdates.push({ payload, filters: [] });
      return updateQuery;
    },
    assertFullyConsumed() {
      assert.equal(expectedEqCalls.length, 0);
    },
  };

  return {
    attempts,
    ticketRows,
    pushTokenQuery,
    tokenUpdates,
    from(table) {
      if (table === 'push_tokens') return pushTokenQuery;
      if (table === 'push_notification_attempts') {
        return {
          insert(payload) {
            attempts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === 'push_notification_tickets') {
        return {
          insert(payload) {
            if (Array.isArray(payload)) {
              ticketRows.push(...payload);
            } else if (payload) {
              ticketRows.push(payload);
            }
            return Promise.resolve({ error: ticketInsertError });
          },
        };
      }
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

  it('scopes token deactivation and preserves accepted ticket counts when ticket storage fails', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'test-token';
    const supabase = createTokenSupabase({
      ticketInsertError: { message: 'insert failed' },
    });
    const expo = {
      chunkPushNotifications(messages) {
        return [messages];
      },
      sendPushNotificationsAsync() {
        return Promise.resolve([
          { status: 'ok', id: 'ticket-1' },
          {
            status: 'error',
            message: 'Device is not registered',
            details: { error: 'DeviceNotRegistered' },
          },
        ]);
      },
    };

    const result = await notifyMerchant({
      supabase,
      expo,
      merchantId: 'merchant-1',
      title: 'Low Stock Alert',
      body: 'Phone Case is low on stock',
      data: { type: 'low_stock' },
      channelId: 'stock',
    });

    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.match(result.errors.join('\n'), /insert failed/);
    supabase.pushTokenQuery.assertFullyConsumed();
    assert.deepEqual(supabase.ticketRows, [
      {
        ticket_id: 'ticket-1',
        push_token: 'ExpoPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
        merchant_id: 'merchant-1',
        user_id: null,
        app_type: 'admin',
        channel: 'stock',
        notification_type: 'low_stock',
        status: 'pending',
      },
    ]);
    assert.deepEqual(supabase.tokenUpdates, [
      {
        payload: { is_active: false },
        filters: [
          ['merchant_id', 'merchant-1'],
          ['app_type', 'admin'],
          ['token', ['ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]']],
        ],
      },
    ]);
    const { errors: attemptErrors, ...attempt } = supabase.attempts[0];
    assert.deepEqual(attempt, {
      merchant_id: 'merchant-1',
      user_id: null,
      app_type: 'admin',
      channel: 'stock',
      notification_type: 'low_stock',
      title: 'Low Stock Alert',
      body: 'Phone Case is low on stock',
      payload: { type: 'low_stock' },
      token_count: 2,
      sent_count: 1,
      failed_count: 1,
      status: 'partial_failure',
    });
    assert.deepEqual(attemptErrors, result.errors);
  });
});
