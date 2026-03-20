import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMerchantByIdentifier = vi.fn();
const getCachedCategoryPageData = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier,
  getCachedCategoryPageData,
}));

describe('GET /[category]/index.html.md', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns category markdown', async () => {
    getMerchantByIdentifier.mockResolvedValue({
      id: 'm1',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    });
    getCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      fallbackName: 'Phones',
      fallbackDescription: 'Shop phones.',
      products: [
        {
          id: 'p1',
          name: 'iPhone 15',
          slug: 'iphone-15',
          price: 1000,
          category: 'Phones',
          images: ['https://img.test/iphone.jpg'],
        },
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/phones/index.html.md'),
      {
        params: Promise.resolve({ slug: 'ogabassey.com', category: 'phones' }),
      }
    );
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(body).toContain('# Phones');
  });
});
