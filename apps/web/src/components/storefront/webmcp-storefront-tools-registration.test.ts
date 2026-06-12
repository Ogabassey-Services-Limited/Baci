import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseCatalogSearchInput,
  registerWebMcpStorefrontTools,
  type WebMcpTool,
} from './webmcp-storefront-tools-registration';

const originalFetch = global.fetch;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function registerTools() {
  const registerTool = vi.fn();
  const signal = new AbortController().signal;

  registerWebMcpStorefrontTools({
    merchantId: '11111111-1111-4111-8111-111111111111',
    merchantSlug: 'ogabassey',
    modelContext: { registerTool },
    signal,
  });

  return {
    signal,
    tools: registerTool.mock.calls.map(([tool]) => tool as WebMcpTool),
  };
}

describe('webmcp-storefront-tools-registration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('normalizes catalog search input without loading runtime schema validators', () => {
    expect(
      parseCatalogSearchInput({
        brand: ' Apple ',
        category: ' Phones ',
        limit: 5,
        query: ' iphone ',
        sort: 'price-desc',
      })
    ).toEqual({
      brand: 'Apple',
      category: 'Phones',
      limit: 5,
      query: 'iphone',
      sort: 'price-desc',
    });

    expect(
      parseCatalogSearchInput({ limit: 51, query: '   ', sort: 'unsafe' })
    ).toEqual({
      brand: undefined,
      category: undefined,
      limit: undefined,
      query: undefined,
      sort: undefined,
    });
  });

  it('registers tools that use JSON contracts and public storefront APIs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ products: [{ id: 'product-1' }] }));
    global.fetch = fetchMock as typeof fetch;

    const { signal, tools } = registerTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'search_catalog',
      'get_product',
      'get_store_policies',
    ]);
    expect(tools[0].inputSchema).toMatchObject({ type: 'object' });

    await expect(
      tools[1].execute({ product_id: ' product-1 ' })
    ).resolves.toEqual({ product: { id: 'product-1' } });

    const requestedUrl = new URL(
      fetchMock.mock.calls[0][0] as string,
      'https://ogabassey.com'
    );
    expect(requestedUrl.searchParams.get('ids')).toBe('product-1');
    expect(requestedUrl.searchParams.get('merchant_id')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal });
  });

  it('ignores truthy non-Promise registration returns from injected model contexts', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const registerTool = vi.fn(() => true);

    registerWebMcpStorefrontTools({
      merchantId: '11111111-1111-4111-8111-111111111111',
      merchantSlug: 'ogabassey',
      modelContext: { registerTool },
      signal: new AbortController().signal,
    });

    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('passes the registration abort signal through policy document fetches', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/auth.md') {
        return Promise.resolve(new Response('# Auth', { status: 200 }));
      }

      return Promise.resolve(jsonResponse({ capabilities: ['catalog'] }));
    });
    global.fetch = fetchMock as typeof fetch;

    const { signal, tools } = registerTools();
    await expect(tools[2].execute({})).resolves.toMatchObject({
      auth_markdown: '# Auth',
      agent_commerce: { capabilities: ['catalog'] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/auth.md',
      expect.objectContaining({ signal })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/agent-commerce.json',
      expect.objectContaining({ signal })
    );
  });
});
