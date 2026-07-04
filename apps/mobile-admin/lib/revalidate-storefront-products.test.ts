import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidateStorefrontProducts } from './revalidate-storefront-products';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

describe('revalidateStorefrontProducts', () => {
  beforeEach(() => {
    mocks.apiClient.mockReset();
  });

  it('posts the saved product entries to the web cache-revalidate endpoint', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true });

    await revalidateStorefrontProducts([
      { slug: 'iphone-15', id: 'prod-1', category: 'Smartphones' },
    ]);

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/cache/revalidate', {
      method: 'POST',
      body: JSON.stringify({
        targets: ['products'],
        products: [
          { slug: 'iphone-15', id: 'prod-1', category: 'Smartphones' },
        ],
      }),
    });
  });

  it('includes the active merchantId in the payload when provided', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true });

    await revalidateStorefrontProducts(
      [{ slug: 'iphone-15', id: 'prod-1', category: 'Smartphones' }],
      'merchant-42'
    );

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/cache/revalidate', {
      method: 'POST',
      body: JSON.stringify({
        targets: ['products'],
        products: [
          { slug: 'iphone-15', id: 'prod-1', category: 'Smartphones' },
        ],
        merchantId: 'merchant-42',
      }),
    });
  });

  it('omits merchantId from the payload when it is blank', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true });

    await revalidateStorefrontProducts([{ slug: 'iphone-15' }], '   ');

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/cache/revalidate', {
      method: 'POST',
      body: JSON.stringify({
        targets: ['products'],
        products: [{ slug: 'iphone-15' }],
      }),
    });
  });

  it('does not call the API when no entry has a slug or id', async () => {
    await revalidateStorefrontProducts([{ category: 'Smartphones' }]);

    expect(mocks.apiClient).not.toHaveBeenCalled();
  });

  it('never throws when the request fails (fire-and-forget)', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('network down'));

    await expect(
      revalidateStorefrontProducts([{ slug: 'iphone-15' }])
    ).resolves.toBeUndefined();
  });
});
