import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { handleEventRequest } from './index.js';

function makeEnv() {
  return {
    ORIGIN_EVENTS_URL: 'https://usebaci.com/api/events',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_URL: 'https://test.supabase.co',
  };
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

describe('handleEventRequest', () => {
  it('stores page_view events directly in Supabase', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () => {
      return new Response(null, { status: 201 });
    });

    const response = await handleEventRequest(
      new Request('https://ogabassey.com/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: 'merchant-123',
          page_url: 'https://ogabassey.com/products',
          referrer: 'https://google.com',
          session_id: 'sess-1',
          timestamp: '2026-06-12T13:00:00.000Z',
        }),
      }),
      makeEnv()
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), { success: true });
    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://test.supabase.co/rest/v1/analytics_events');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Prefer, 'return=minimal');
    assert.deepEqual(JSON.parse(init.body), {
      merchant_id: 'merchant-123',
      event_type: 'page_view',
      event_data: {
        page_url: 'https://ogabassey.com/products',
        referrer: 'https://google.com',
        session_id: 'sess-1',
      },
      source: 'web',
      event_timestamp: '2026-06-12T13:00:00.000Z',
    });

    fetchMock.mock.restore();
  });

  it('stores page_view event ids without REST upsert semantics', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () => {
      return new Response(null, { status: 201 });
    });

    const response = await handleEventRequest(
      new Request('https://ogabassey.com/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_id: 'evt-1',
          event_type: 'page_view',
          merchant_id: 'merchant-123',
        }),
      }),
      makeEnv()
    );

    assert.equal(response.status, 200);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://test.supabase.co/rest/v1/analytics_events');
    assert.equal(init.headers.Prefer, 'return=minimal');
    assert.equal(JSON.parse(init.body).event_id, 'evt-1');

    fetchMock.mock.restore();
  });

  it('forwards conversion-style events to origin', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () => {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });

    const response = await handleEventRequest(
      new Request('https://ogabassey.com/api/events', {
        method: 'POST',
        headers: {
          cookie: '_fbp=fbp-value',
          'content-type': 'application/json',
          'user-agent': 'test-agent',
        },
        body: JSON.stringify({
          event_type: 'product_view',
          merchant_id: 'merchant-123',
          product_id: 'product-1',
        }),
      }),
      makeEnv()
    );

    assert.equal(response.status, 200);
    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://usebaci.com/api/events');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.get('cookie'), '_fbp=fbp-value');
    assert.equal(
      init.headers.get('x-baci-edge-forwarded'),
      'cloudflare-event-ingest-worker'
    );
    assert.match(init.body, /product_view/);

    fetchMock.mock.restore();
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await handleEventRequest(
      new Request('https://ogabassey.com/api/events', {
        method: 'POST',
        body: JSON.stringify({ event_type: 'page_view' }),
      }),
      makeEnv()
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await readJson(response), {
      error: 'Missing required fields: event_type and merchant_id',
    });
  });

  it('returns 500 when Supabase write fails', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () => {
      return new Response('nope', { status: 500 });
    });

    const response = await handleEventRequest(
      new Request('https://ogabassey.com/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: 'merchant-123',
        }),
      }),
      makeEnv()
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await readJson(response), {
      error: 'Internal server error',
    });

    fetchMock.mock.restore();
  });
});
