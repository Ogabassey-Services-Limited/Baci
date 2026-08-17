import { describe, expect, it, vi } from 'vitest';
import { loadMappedProductIds } from './publish-products-data-loader';

describe('loadMappedProductIds', () => {
  it('returns an empty set when the mapped-product lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    );

    await expect(
      loadMappedProductIds('integration-1', new AbortController().signal)
    ).resolves.toEqual(new Set());
  });
});
