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
  it('emits noindex,follow metadata with a request-scoped canonical URL', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphone 16' }),
    });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
    expect(metadata.alternates).toMatchObject({
      canonical: 'https://shop.example.ng/search?q=iphone%2016',
    });
  });

  it('treats a query that sanitizes to empty as an empty search', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: '< >' }),
    });

    expect(metadata.title).toBe('Search | Ogabassey');
    expect(metadata.alternates).toMatchObject({
      canonical: 'https://shop.example.ng/search',
    });
  });
});
