import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMerchantByIdentifier = vi.fn();
const getCachedProductWithDetails = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier,
  getCachedProductWithDetails,
}));

describe('GET /[category]/[productSlug].md', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns product markdown', async () => {
    getMerchantByIdentifier.mockResolvedValue({
      id: 'm1',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    });
    getCachedProductWithDetails.mockResolvedValue({
      id: 'p1',
      name: 'iPhone 15',
      slug: 'iphone-15',
      description: 'Flagship smartphone',
      price: 1000,
      category: 'Phones',
      brand: 'Apple',
      stock: 3,
      images: ['https://img.test/iphone.jpg'],
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/phones/iphone-15.md'),
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          category: 'phones',
          productSlug: 'iphone-15',
        }),
      }
    );
    const body = await response.text();

    expect(body).toContain('# iPhone 15');
    expect(body).toContain('Canonical product URL');
  });
});
