import { describe, expect, it, vi } from 'vitest';
import {
  loadMappedProductIds,
  loadPublishProducts,
} from './publish-products-data-loader';

describe('loadMappedProductIds', () => {
  it('throws when the mapped-product lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    );

    await expect(
      loadMappedProductIds('integration-1', new AbortController().signal)
    ).rejects.toThrow('Failed to load mapped Jumia products');
  });

  it('throws when the mapped-product payload is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ids: ['product-1'] }),
      })
    );

    await expect(
      loadMappedProductIds('integration-1', new AbortController().signal)
    ).rejects.toThrow('Failed to load mapped Jumia products');
  });
});

describe('loadPublishProducts', () => {
  it('loads products beyond the former 50-page cap', async () => {
    const fetchMock = vi.fn((url: string) => {
      const page = Number(
        new URL(url, 'http://localhost').searchParams.get('page')
      );
      return Promise.resolve({
        ok: true,
        json: async () => ({
          products: [
            { id: `product-${page}`, name: `Product ${page}`, price: page },
          ],
          pagination: { page, limit: 100, totalPages: 51 },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const products = await loadPublishProducts(
      undefined,
      new AbortController().signal
    );

    expect(products).toHaveLength(51);
    expect(products.at(-1)?.id).toBe('product-51');
    expect(fetchMock).toHaveBeenCalledTimes(51);
  });
});
