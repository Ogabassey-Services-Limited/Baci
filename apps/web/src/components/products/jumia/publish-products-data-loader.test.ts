import { describe, expect, it, vi } from 'vitest';
import { loadMappedProductIds } from './publish-products-data-loader';

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
