import { describe, expect, it, vi } from 'vitest';
import {
  cancelUcpCart,
  convertUcpCartToCheckout,
  createUcpCart,
  getUcpCart,
  lookupUcpCatalogItems,
  searchUcpCatalog,
  updateUcpCart,
} from './agentic-ucp-client';

const baseConfig = {
  apiBaseUrl: 'https://ogabassey.com',
  apiKey: 'agentic-api-key',
  now: () => new Date('2026-05-26T12:00:00.000Z'),
  requestIdFactory: () => 'request-1',
  signingKey: 'signing-secret',
};

describe('agentic UCP client', () => {
  it('posts catalog search requests to the UCP catalog route', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), { status: 200 })
    );

    await searchUcpCatalog(
      { cursor: 'next', limit: 10, query: 'iphone' },
      { ...baseConfig, fetchImpl }
    );

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ogabassey.com/api/agentic/catalog/search');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      pagination: { cursor: 'next', limit: 10 },
      query: 'iphone',
    });
  });

  it('creates UCP carts with UCP line item shape and idempotency', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cart_1', status: 'active' }), {
        status: 201,
      })
    );

    await createUcpCart(
      {
        currency: 'NGN',
        idempotency_key: 'idem-cart-1',
        items: [{ id: 'product-1', quantity: 2 }],
      },
      { ...baseConfig, fetchImpl }
    );

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ogabassey.com/api/agentic/carts');
    expect(JSON.parse(String(init.body))).toEqual({
      currency: 'NGN',
      line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
    });
    expect(init.headers).toMatchObject({
      'idempotency-key': 'idem-cart-1',
    });
  });

  it('creates UCP carts with defaults, generated idempotency, and optional fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cart_1', status: 'active' }), {
        status: 201,
      })
    );

    await createUcpCart(
      {
        buyer: { email: 'buyer@example.com' },
        items: [{ id: 'product-1', quantity: 1 }],
        shipping_address: { address_locality: 'Lagos' },
      },
      { ...baseConfig, fetchImpl }
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      buyer: { email: 'buyer@example.com' },
      currency: 'NGN',
      line_items: [{ item: { id: 'product-1' }, quantity: 1 }],
      shipping_address: { address_locality: 'Lagos' },
    });
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toMatch(/^mcp_ucp_cart_/);
  });

  it('looks up exact UCP catalog item ids', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), { status: 200 })
    );

    await lookupUcpCatalogItems(
      { filters: { condition: 'new' }, ids: ['product-1'] },
      { ...baseConfig, fetchImpl }
    );

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ogabassey.com/api/agentic/catalog/lookup');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      filters: { condition: 'new' },
      ids: ['product-1'],
    });
  });

  it('updates and cancels UCP carts with idempotency keys', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cart_1', status: 'active' }), {
        status: 200,
      })
    );

    await updateUcpCart(
      {
        cart_id: 'cart_1',
        idempotency_key: 'idem-update-1',
        items: [{ id: 'product-2', quantity: 3 }],
      },
      { ...baseConfig, fetchImpl }
    );
    await cancelUcpCart(
      { cart_id: 'cart_1', idempotency_key: 'idem-cancel-1' },
      { ...baseConfig, fetchImpl }
    );

    const [, updateInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(updateInit.body))).toEqual({
      line_items: [{ item: { id: 'product-2' }, quantity: 3 }],
    });
    expect(updateInit.headers).toMatchObject({
      'idempotency-key': 'idem-update-1',
    });

    const [cancelUrl, cancelInit] = fetchImpl.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(cancelUrl).toBe(
      'https://ogabassey.com/api/agentic/carts/cart_1/cancel'
    );
    expect(cancelInit.body).toBe(JSON.stringify({}));
    expect(cancelInit.headers).toMatchObject({
      'idempotency-key': 'idem-cancel-1',
    });
  });

  it('reads and converts encoded UCP cart ids through their route paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cart_1' }), { status: 200 })
    );

    await getUcpCart({ cart_id: 'cart/1' }, { ...baseConfig, fetchImpl });
    await convertUcpCartToCheckout(
      { cart_id: 'cart/1', idempotency_key: 'idem-convert-1' },
      { ...baseConfig, fetchImpl }
    );

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://ogabassey.com/api/agentic/carts/cart%2F1'
    );
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://ogabassey.com/api/agentic/carts/cart%2F1/checkout'
    );
  });

  it('surfaces non-2xx route errors to callers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Cart not found' }), { status: 404 })
    );

    const result = await getUcpCart(
      { cart_id: 'missing-cart' },
      { ...baseConfig, fetchImpl }
    );

    expect(result).toMatchObject({
      error: 'Cart not found',
      ok: false,
      status: 404,
    });
  });
});
