import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePublishProductsDialog } from './use-publish-products-dialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

function createFetchMock(
  handlers: Record<
    string,
    () => Promise<{
      ok: boolean;
      json: () => Promise<unknown>;
    }>
  >
) {
  return vi.fn((url: string) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return handler();
      }
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

describe('usePublishProductsDialog', () => {
  it('loads active products across pages when the dialog opens', async () => {
    const fetchMock = createFetchMock({
      'mapped-product-ids': async () => ({
        ok: true,
        json: async () => ({ productIds: [] }),
      }),
      'page=1': async () => ({
        ok: true,
        json: async () => ({
          products: [{ id: 'prod-1', name: 'Phone', price: 10 }],
          pagination: { page: 1, limit: 100, totalPages: 2 },
        }),
      }),
      'page=2': async () => ({
        ok: true,
        json: async () => ({
          products: [{ id: 'prod-2', name: 'Tablet', price: 20 }],
          pagination: { page: 2, limit: 100, totalPages: 2 },
        }),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      usePublishProductsDialog({
        integrationId: 'integration-1',
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/marketplace/jumia/products/mapped-product-ids?integrationId=integration-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products?status=active&limit=100&page=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products?status=active&limit=100&page=2',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.filteredProducts).toHaveLength(2);
  });

  it('sets load error when product pagination fetch is not ok', async () => {
    const fetchMock = createFetchMock({
      'mapped-product-ids': async () => ({
        ok: true,
        json: async () => ({ productIds: [] }),
      }),
      '/api/products': async () => ({
        ok: false,
        json: async () => ({}),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      usePublishProductsDialog({
        integrationId: 'integration-1',
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.loadError).toBe('Failed to load active products');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retains products from a single page when pagination metadata is missing', async () => {
    const fetchMock = createFetchMock({
      'mapped-product-ids': async () => ({
        ok: true,
        json: async () => ({ productIds: [] }),
      }),
      '/api/products': async () => ({
        ok: true,
        json: async () => ({
          products: [{ id: 'prod-1', name: 'Phone', price: 10 }],
        }),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      usePublishProductsDialog({
        integrationId: 'integration-1',
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filteredProducts).toEqual([
      { id: 'prod-1', name: 'Phone', price: 10 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
