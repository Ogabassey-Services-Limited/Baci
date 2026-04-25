import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getAllOrders, refreshAccessToken } from './jumia-api.mjs';

const originalFetch = globalThis.fetch;
const originalEnvironment = process.env.JUMIA_ENVIRONMENT;
const originalClientId = process.env.JUMIA_CLIENT_ID;

function createSupabaseTokenUpdateMock() {
  const updates = [];
  const expectedEqCalls = [
    ['id', 'integration-1'],
    ['merchant_id', 'merchant-1'],
  ];
  return {
    updates,
    from(table) {
      assert.equal(table, 'marketplace_integrations');
      return {
        update(payload) {
          updates.push(payload);
          return this;
        },
        eq(column, value) {
          assert.deepEqual([column, value], expectedEqCalls.shift());
          return expectedEqCalls.length === 0
            ? Promise.resolve({ error: null })
            : this;
        },
      };
    },
  };
}

describe('Jumia worker API client', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnvironment === undefined) {
      delete process.env.JUMIA_ENVIRONMENT;
    } else {
      process.env.JUMIA_ENVIRONMENT = originalEnvironment;
    }
    if (originalClientId === undefined) {
      delete process.env.JUMIA_CLIENT_ID;
    } else {
      process.env.JUMIA_CLIENT_ID = originalClientId;
    }
  });

  it('rejects token refresh without a refresh token', async () => {
    await assert.rejects(
      refreshAccessToken({}, { refresh_token: '' }),
      /Refresh token is missing/
    );
  });

  it('persists refreshed tokens returned by Jumia', async () => {
    process.env.JUMIA_ENVIRONMENT = 'staging';
    process.env.JUMIA_CLIENT_ID = 'client-1';
    const supabase = createSupabaseTokenUpdateMock();
    const integration = {
      id: 'integration-1',
      merchant_id: 'merchant-1',
      refresh_token: 'refresh-1',
    };
    globalThis.fetch = (url, init) => {
      assert.equal(url, 'https://vendor-api-staging.jumia.com/token');
      assert.equal(init.method, 'POST');
      assert.equal(
        init.headers['Content-Type'],
        'application/x-www-form-urlencoded'
      );
      const body = new URLSearchParams(init.body);
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('refresh_token'), 'refresh-1');
      assert.equal(body.get('client_id'), 'client-1');
      return Promise.resolve(
        Response.json({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          expires_in: 3600,
        })
      );
    };

    const beforeRefresh = Date.now();
    await refreshAccessToken(supabase, integration);
    const afterRefresh = Date.now();
    const expiresAt = new Date(integration.token_expires_at).getTime();

    assert.equal(integration.access_token, 'access-2');
    assert.equal(integration.refresh_token, 'refresh-2');
    assert.equal(supabase.updates.length, 1);
    assert.equal(supabase.updates[0].access_token, 'access-2');
    assert.equal(
      supabase.updates[0].token_expires_at,
      integration.token_expires_at
    );
    assert.ok(expiresAt >= beforeRefresh + 3_600_000);
    assert.ok(expiresAt <= afterRefresh + 3_600_000);
  });

  it('fetches all order pages until Jumia marks the response complete', async () => {
    process.env.JUMIA_ENVIRONMENT = 'staging';
    const requestedUrls = [];
    globalThis.fetch = (url, init) => {
      requestedUrls.push(url);
      assert.ok(url.startsWith('https://vendor-api-staging.jumia.com/'));
      assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer access-1');
      const parsedUrl = new URL(url);
      if (!parsedUrl.searchParams.has('nextToken')) {
        return Promise.resolve(
          Response.json({
            orders: [{ id: 'order-1' }],
            nextToken: 'page-2',
            isLastPage: false,
          })
        );
      }
      assert.equal(parsedUrl.searchParams.get('nextToken'), 'page-2');
      return Promise.resolve(
        Response.json({
          orders: [{ id: 'order-2' }],
          isLastPage: true,
        })
      );
    };

    const orders = await getAllOrders(
      {},
      {
        access_token: 'access-1',
        token_expires_at: '2999-01-01T00:00:00.000Z',
      },
      { size: 100 }
    );

    assert.deepEqual(orders, [{ id: 'order-1' }, { id: 'order-2' }]);
    assert.equal(requestedUrls.length, 2);
  });
});
