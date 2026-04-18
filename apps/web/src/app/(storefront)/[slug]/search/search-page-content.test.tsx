import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { getStorefrontSearchProducts } from '@/lib/storefront-search';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: vi.fn(),
  getStorefrontSearchProducts: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('../products/product-index-card', () => ({
  ProductIndexCard: ({ product }: { product: { name: string } }) => (
    <div>{product.name}</div>
  ),
}));

const { SearchPageContent } = await import('./search-page-content');

describe('SearchPageContent', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getStorefrontSearchProducts).mockReset();
    mockHeaders.mockReset();
  });

  it('shows the first slice of capped results and request-scoped schema URLs', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'shop.example.ng',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    vi.mocked(getStorefrontSearchProducts).mockResolvedValue({
      count: 200,
      didYouMean: 'iphone',
      products: Array.from({ length: 20 }, (_, index) => ({
        id: `product-${index + 1}`,
        name: index === 0 ? 'iPhone 16' : `iPhone ${index + 17}`,
        price: 1200000 + index * 1000,
        slug: index === 0 ? 'iphone-16' : `iphone-${index + 17}`,
        category: 'Phones',
        category_slug: 'phones',
      })),
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
    expect(
      screen.getByText(/Showing first 20 of 200 results for “iphone”/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Did you mean/i, { selector: 'p' })
    ).toBeInTheDocument();
    expect(screen.getByText('iPhone 16')).toBeInTheDocument();

    const schemas = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).map(
      (script) =>
        JSON.parse(script.textContent || '{}') as {
          '@type'?: string;
          mainEntity?: {
            itemListElement?: Array<{
              item?: { url?: string };
            }>;
          };
        }
    );

    expect(schemas).toHaveLength(2);
    expect(schemas.some((schema) => schema['@type'] === 'BreadcrumbList')).toBe(
      true
    );

    const collectionSchema = schemas.find(
      (schema) => schema['@type'] === 'CollectionPage'
    );
    const breadcrumbSchema = schemas.find(
      (schema) => schema['@type'] === 'BreadcrumbList'
    );

    expect(collectionSchema).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://shop.example.ng/search?q=iphone',
      numberOfItems: 20,
    });
    expect(collectionSchema?.mainEntity?.itemListElement).toHaveLength(20);
    expect(collectionSchema?.mainEntity?.itemListElement?.[0]).toMatchObject({
      item: {
        url: 'https://shop.example.ng/phones/iphone-16',
      },
    });

    expect(breadcrumbSchema).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          item: {
            '@id': 'https://shop.example.ng',
          },
        },
        {
          item: {
            '@id': 'https://shop.example.ng/search?q=iphone',
          },
        },
      ],
    });
  });

  it('shows a start-search prompt when the query is empty', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'shop.example.ng',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    const result = await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: '', page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByRole('heading', { name: /Search Results/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Enter a search term to browse matching products\./i)
    ).toBeInTheDocument();
    expect(getStorefrontSearchProducts).not.toHaveBeenCalled();
    expect(screen.getByText('Start a search')).toBeInTheDocument();
  });

  it('treats a query that sanitizes to empty as an empty search', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'shop.example.ng',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    const result = await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: '< >', page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByText(/Enter a search term to browse matching products\./i)
    ).toBeInTheDocument();
    expect(getStorefrontSearchProducts).not.toHaveBeenCalled();
    expect(screen.getByText('Start a search')).toBeInTheDocument();

    const schemas = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).map(
      (script) =>
        JSON.parse(script.textContent || '{}') as {
          '@type'?: string;
        }
    );

    const collectionSchema = schemas.find(
      (schema) => schema['@type'] === 'CollectionPage'
    );
    const breadcrumbSchema = schemas.find(
      (schema) => schema['@type'] === 'BreadcrumbList'
    );

    expect(collectionSchema).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://shop.example.ng/search',
    });
    expect(breadcrumbSchema).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          item: {
            '@id': 'https://shop.example.ng',
          },
        },
        {
          item: {
            '@id': 'https://shop.example.ng/search',
          },
        },
      ],
    });
  });

  it('shows a no-results state and suggestion when nothing matches', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'proxy.internal'],
        ['x-custom-domain', 'shop.example.ng'],
        ['x-pathname', '/search'],
      ])
    );

    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'shop.example.ng',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    vi.mocked(getStorefrontSearchProducts).mockResolvedValue({
      count: 0,
      didYouMean: 'iphone',
      products: [],
      query: 'iphon',
    } as never);

    const result = await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphon', page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByText(/No results found for “iphon”/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /No products found/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Try searching for/i, { selector: 'p' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We could not find any products matching “iphon”/i)
    ).toBeInTheDocument();
  });
});
