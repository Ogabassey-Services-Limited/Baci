import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPriceBandPageContent } = vi.hoisted(() => ({
  mockPriceBandPageContent: vi.fn((_props: unknown) => (
    <div>Price band page content</div>
  )),
}));

const mockLoadPriceBandPage = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/lib/seo-utils', () => ({
  getIndexableRobotsMetadata: () => ({
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  }),
}));

vi.mock('@/lib/storefront-compare/load-price-band-page', () => ({
  loadPriceBandPage: (...args: unknown[]) => mockLoadPriceBandPage(...args),
}));

vi.mock('./price-band-page-content', () => ({
  PriceBandPageContent: (props: unknown) => mockPriceBandPageContent(props),
}));

const priceBandPageModel = {
  canonicalUrl: 'https://ogabassey.com/smartphones/best-under/under-500k',
  metaTitle: 'Best Smartphones Under ₦500,000 | Ogabassey',
  metaDescription:
    'Compare the best smartphones under ₦500,000 from Ogabassey.',
  heading: 'Best Smartphones Under ₦500,000',
  intro:
    'These are the strongest smartphone options below the ₦500,000 price band.',
  breadcrumbItems: [
    { name: 'Ogabassey', url: 'https://ogabassey.com' },
    { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
    {
      name: 'Best Smartphones Under ₦500,000',
      url: 'https://ogabassey.com/smartphones/best-under/under-500k',
    },
  ],
  products: [
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      price: 480_000,
      stock: 12,
      availability: 'InStock' as const,
      image: 'https://cdn.example.com/a56.jpg',
      description: 'Best midrange pick',
    },
  ],
  isIndexable: true,
  pathPrefix: '',
  payoutCurrency: 'NGN',
};

beforeEach(() => {
  mockLoadPriceBandPage.mockReset();
  mockNotFound.mockClear();
  mockPriceBandPageContent.mockReset();
  mockPriceBandPageContent.mockImplementation(() => (
    <div>Price band page content</div>
  ));
  mockLoadPriceBandPage.mockResolvedValue(priceBandPageModel);
});

describe('price-band page metadata', () => {
  it('defers price-band first paint to the route loader while route params are pending', async () => {
    const { default: PriceBandPage } = await import('./page');
    mockPriceBandPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the price-band page content suspended behind the route loader.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        <PriceBandPage
          params={Promise.resolve({
            slug: 'ogabassey',
            category: 'smartphones',
            priceBandSlug: 'under-500k',
          })}
        />
      </Suspense>
    );

    expect(screen.getByText('Route loader fallback')).toBeInTheDocument();
    expect(
      screen.queryByText('Price band page content')
    ).not.toBeInTheDocument();
  });

  it('emits canonical metadata for curated price-band pages', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        category: 'smartphones',
        priceBandSlug: 'under-500k',
      }),
    });

    expect(mockLoadPriceBandPage).toHaveBeenCalledWith({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-500k',
    });
    expect(metadata.title).toBe(priceBandPageModel.metaTitle);
    expect(metadata.description).toBe(priceBandPageModel.metaDescription);
    expect(metadata.alternates?.canonical).toContain(
      '/smartphones/best-under/under-500k'
    );
    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    });
  });

  it('calls notFound when the price-band loader returns null', async () => {
    mockLoadPriceBandPage.mockResolvedValueOnce(null);
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          priceBandSlug: 'under-500k',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('calls notFound when the price-band page model is not indexable', async () => {
    mockLoadPriceBandPage.mockResolvedValueOnce({
      ...priceBandPageModel,
      isIndexable: false,
    });
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          priceBandSlug: 'under-500k',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
