import type { Dispatch, SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadArchiveOrders } from '@/app/(storefront)/[slug]/receipts/load-archive-orders';
import type { StorefrontOrder } from '@/types/storefront-order';

function createJsonResponse(body: unknown, status = 200): Response {
  const textBody = JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => textBody,
    clone() {
      return createJsonResponse(body, status);
    },
  } as Response;
}

describe('loadArchiveOrders', () => {
  const setOrdersMock = vi.fn();
  const setIsLoadingOrdersMock = vi.fn();
  const setOrdersErrorMock = vi.fn();
  const setOrders = setOrdersMock as Dispatch<
    SetStateAction<StorefrontOrder[]>
  >;
  const setIsLoadingOrders = setIsLoadingOrdersMock as Dispatch<
    SetStateAction<boolean>
  >;
  const setOrdersError = setOrdersErrorMock as Dispatch<
    SetStateAction<string | null>
  >;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads orders successfully', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({ orders: [{ id: 'order-1', items: [] }] })
    );

    await loadArchiveOrders({
      merchantSlug: 'ogabassey',
      setOrders,
      setIsLoadingOrders,
      setOrdersError,
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/storefront/orders?merchantSlug=ogabassey'
    );
    expect(setOrders).toHaveBeenCalledWith([{ id: 'order-1', items: [] }]);
    expect(setOrdersError).toHaveBeenNthCalledWith(1, null);
    expect(setIsLoadingOrders).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoadingOrders).toHaveBeenLastCalledWith(false);
  });

  it('stores an API error and clears orders when the fetch is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({ error: 'Unable to load documents' }, 500)
    );

    await loadArchiveOrders({
      merchantSlug: 'ogabassey',
      setOrders,
      setIsLoadingOrders,
      setOrdersError,
    });

    expect(setOrdersError).toHaveBeenLastCalledWith('Unable to load documents');
    expect(setOrders).toHaveBeenLastCalledWith([]);
    expect(setIsLoadingOrders).toHaveBeenLastCalledWith(false);
  });

  it('stores a connection error and clears orders when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));

    await loadArchiveOrders({
      merchantSlug: 'ogabassey',
      setOrders,
      setIsLoadingOrders,
      setOrdersError,
    });

    expect(setOrdersError).toHaveBeenLastCalledWith(
      'Unable to connect. Please try again.'
    );
    expect(setOrders).toHaveBeenLastCalledWith([]);
    expect(setIsLoadingOrders).toHaveBeenLastCalledWith(false);
  });
});
