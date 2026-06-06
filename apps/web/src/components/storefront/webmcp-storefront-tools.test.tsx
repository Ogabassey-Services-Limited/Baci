import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebMcpStorefrontTools } from './webmcp-storefront-tools';

type RegisteredTool = {
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
  inputSchema: Record<string, unknown>;
  name: string;
};

type RegisterOptions = { signal?: AbortSignal };

type TestModelContext = { registerTool: ReturnType<typeof vi.fn> };

type TestDocument = Document & { modelContext?: TestModelContext };

const originalFetch = global.fetch;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getTestDocument(): TestDocument {
  return document as TestDocument;
}

function getRegisterTool() {
  const registerTool = getTestDocument().modelContext?.registerTool;
  if (!registerTool) {
    throw new Error('modelContext.registerTool missing');
  }

  return vi.mocked(registerTool);
}

function renderTools() {
  return render(
    <WebMcpStorefrontTools
      merchantId="11111111-1111-4111-8111-111111111111"
      merchantSlug="ogabassey"
    />
  );
}

async function getRegisteredTools() {
  const registerTool = getRegisterTool();

  await waitFor(() => {
    expect(registerTool).toHaveBeenCalledTimes(3);
  });

  return registerTool.mock.calls.map(([tool]) => tool as RegisteredTool);
}

describe('WebMcpStorefrontTools', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    global.fetch = originalFetch;
  });

  it('no-ops when browser model context is unavailable', () => {
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });

    expect(() => renderTools()).not.toThrow();
    expect(getTestDocument().modelContext).toBeUndefined();
  });

  it('registers read-only storefront tools with abortable cleanup', async () => {
    const registerTool = getRegisterTool();

    const { unmount } = renderTools();

    const registeredTools = await getRegisteredTools();
    expect(registeredTools.map((tool) => tool.name)).toEqual([
      'search_catalog',
      'get_product',
      'get_store_policies',
    ]);
    for (const tool of registeredTools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        untrustedContentHint: true,
      });
    }

    const registerOptions = registerTool.mock.calls[0][1] as RegisterOptions;
    expect(registerOptions.signal?.aborted).toBe(false);

    unmount();

    expect(registerOptions.signal?.aborted).toBe(true);
  });

  it('executes catalog search against the public same-origin storefront API', async () => {
    const registerTool = getRegisterTool();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ products: [{ id: 'product-1' }] }));
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    await getRegisteredTools();

    const searchTool = registerTool.mock.calls[0][0] as RegisteredTool;
    const result = await searchTool.execute({
      brand: 'Apple',
      limit: 5,
      query: 'iphone',
      sort: 'price-desc',
    });

    expect(result).toEqual({ products: [{ id: 'product-1' }] });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/storefront/products?'),
      expect.objectContaining({
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
    );

    const requestedUrl = new URL(
      fetchMock.mock.calls[0][0] as string,
      'https://ogabassey.com'
    );
    expect(requestedUrl.searchParams.get('merchant_id')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(requestedUrl.searchParams.get('q')).toBe('iphone');
    expect(requestedUrl.searchParams.get('brand')).toBe('Apple');
    expect(requestedUrl.searchParams.get('limit')).toBe('5');
    expect(requestedUrl.searchParams.get('sort')).toBe('price-desc');
  });

  it('falls back to safe catalog params and returns non-OK search errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    const [searchTool] = await getRegisteredTools();
    const result = await searchTool.execute({ limit: -1, sort: 'unsafe' });

    expect(result).toEqual({
      error: 'Request failed with status 503',
      status: 503,
    });

    const requestedUrl = new URL(
      fetchMock.mock.calls[0][0] as string,
      'https://ogabassey.com'
    );
    expect(requestedUrl.searchParams.get('limit')).toBe('10');
    expect(requestedUrl.searchParams.has('sort')).toBe(false);
  });

  it('validates get_product input and returns the first matching product', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ products: [{ id: 'product-1' }] }));
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    const [, productTool] = await getRegisteredTools();
    await expect(productTool.execute({})).resolves.toEqual({
      error: 'product_id is required',
      status: 400,
    });
    await expect(productTool.execute({ product_id: ' ' })).resolves.toEqual({
      error: 'Invalid product_id',
      status: 400,
    });
    const result = await productTool.execute({ product_id: 'product-1' });

    expect(result).toEqual({ product: { id: 'product-1' } });
    const requestedUrl = new URL(
      fetchMock.mock.calls[0][0] as string,
      'https://ogabassey.com'
    );
    expect(requestedUrl.searchParams.get('ids')).toBe('product-1');
  });

  it('propagates get_product fetch errors and returns null for empty matches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ products: [] }));
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    const [, productTool] = await getRegisteredTools();

    await expect(
      productTool.execute({ product_id: 'missing-product' })
    ).resolves.toEqual({
      error: 'Request failed with status 404',
      status: 404,
    });
    await expect(
      productTool.execute({ product_id: 'empty-product' })
    ).resolves.toEqual({ product: null });
  });

  it('reads store policy discovery from same-origin public documents', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/auth.md') {
        return Promise.resolve(new Response('# Auth', { status: 200 }));
      }

      return Promise.resolve(jsonResponse({ capabilities: ['catalog'] }));
    });
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    const [, , policyTool] = await getRegisteredTools();
    const result = await policyTool.execute({});

    expect(result).toMatchObject({
      auth_markdown: '# Auth',
      merchant_slug: 'ogabassey',
      agent_commerce: { capabilities: ['catalog'] },
      discovery: {
        auth_doc: '/auth.md',
        openapi: '/openapi.json',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/auth.md',
      expect.objectContaining({ credentials: 'same-origin' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/agent-commerce.json',
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  it('returns null auth markdown when policy text fetch throws', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchMock = vi.fn((url: string) => {
      if (url === '/auth.md') {
        return Promise.reject(new Error('offline'));
      }

      return Promise.resolve(jsonResponse({ capabilities: ['catalog'] }));
    });
    global.fetch = fetchMock as typeof fetch;

    renderTools();

    const [, , policyTool] = await getRegisteredTools();
    const result = await policyTool.execute({});

    expect(result).toMatchObject({
      auth_markdown: null,
      agent_commerce: { capabilities: ['catalog'] },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[WebMCP] Failed to fetch text document',
      expect.objectContaining({ url: '/auth.md' })
    );

    fetchMock.mockImplementation((url: string) => {
      if (url === '/agent-commerce.json') {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve(new Response('# Auth', { status: 200 }));
    });
    await expect(policyTool.execute({})).resolves.toMatchObject({
      auth_markdown: '# Auth',
      agent_commerce: { error: 'offline', status: 0 },
    });
  });
});
