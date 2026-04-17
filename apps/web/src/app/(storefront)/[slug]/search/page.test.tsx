import { describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('./search-page-content', () => ({
  SearchPageContent: () => <div>Search content</div>,
}));

const { generateMetadata } = await import('./page');

describe('storefront search page metadata', () => {
  it('emits noindex,follow metadata for search results', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'ogabassey.com'],
        ['x-pathname', '/search'],
      ])
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphone' }),
    });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });
});
