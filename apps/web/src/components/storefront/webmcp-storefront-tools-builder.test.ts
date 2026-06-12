import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStorefrontWebMcpTools } from './webmcp-storefront-tools-builder';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('webmcp-storefront-tools-builder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('builds read-only storefront tools with JSON input contracts', () => {
    const tools = buildStorefrontWebMcpTools({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      signal: new AbortController().signal,
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      'search_catalog',
      'get_product',
      'get_store_policies',
    ]);
    expect(tools[0].annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(tools[0].inputSchema).toMatchObject({ type: 'object' });
  });

  it('executes catalog and product tools against scoped public product APIs', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ products: [{ id: 'product-1' }] }))
    );
    global.fetch = fetchMock as typeof fetch;
    const signal = new AbortController().signal;
    const [searchTool, productTool] = buildStorefrontWebMcpTools({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      signal,
    });

    await expect(
      searchTool.execute({ query: ' iphone ', limit: 5 })
    ).resolves.toEqual({
      products: [{ id: 'product-1' }],
    });
    await expect(
      productTool.execute({ product_id: ' product-1 ' })
    ).resolves.toEqual({
      product: { id: 'product-1' },
    });

    const searchUrl = new URL(
      fetchMock.mock.calls[0][0] as string,
      'https://ogabassey.com'
    );
    expect(searchUrl.searchParams.get('merchant_id')).toBe('merchant-1');
    expect(searchUrl.searchParams.get('q')).toBe('iphone');
    expect(searchUrl.searchParams.get('limit')).toBe('5');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal });

    const productUrl = new URL(
      fetchMock.mock.calls[1][0] as string,
      'https://ogabassey.com'
    );
    expect(productUrl.searchParams.get('ids')).toBe('product-1');
  });

  it('returns policy discovery with public same-origin documents', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url);
      if (requestUrl === '/auth.md') {
        return Promise.resolve(new Response('# Auth', { status: 200 }));
      }

      return Promise.resolve(jsonResponse({ capabilities: ['catalog'] }));
    });
    global.fetch = fetchMock as typeof fetch;
    const [, , policyTool] = buildStorefrontWebMcpTools({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      signal: new AbortController().signal,
    });

    await expect(policyTool.execute({})).resolves.toMatchObject({
      auth_markdown: '# Auth',
      merchant_slug: 'ogabassey',
      agent_commerce: { capabilities: ['catalog'] },
      discovery: {
        auth_doc: '/auth.md',
        openapi: '/openapi.json',
      },
    });
  });
});
