import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { getStorefrontSearchProducts } from '@/lib/storefront-search';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: vi.fn(),
  getStorefrontSearchProducts: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('../products/product-index-card', () => ({
  ProductIndexCard: ({ product }: { product: { name: string } }) => (
    <div>{product.name}</div>
  ),
}));

const { SearchPageContent } = await import('./search-page-content');

describe('SearchPageContent', () => {
  it('renders the search query and result count', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    vi.mocked(getStorefrontSearchProducts).mockResolvedValue({
      count: 2,
      didYouMean: 'iphone',
      products: [
        {
          id: 'product-1',
          name: 'iPhone 16',
          price: 1200000,
          slug: 'iphone-16',
          category: 'Phones',
          category_slug: 'phones',
        },
      ],
      query: 'iphone',
    } as never);

    const result = await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphone', page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByRole('heading', { name: /Search Results/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Results for “iphone”/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Did you mean/i, { selector: 'p' })
    ).toBeInTheDocument();
    expect(screen.getByText('iPhone 16')).toBeInTheDocument();
  });
});
