import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockHeadersGet = vi.fn((key: string) => {
  if (key === 'host') return 'ogabassey.com';
  return null;
});

const mockLimit = vi.fn(() =>
  Promise.resolve({
    data: [
      {
        id: 'product-1',
        name: 'Legion Pro 7',
        slug: 'legion-pro-7',
        description: 'Gaming laptop',
        price: 2500000,
        compare_at_price: null,
        images: ['https://cdn.example.com/legion.jpg'],
        category: 'Laptops',
        brand: 'Lenovo',
        condition: 'new',
        stock: 4,
        rating: 4.7,
        merchant_id: 'merchant-1',
        status: 'active',
        product_categories: [
          { categories: { name: 'Laptops', slug: 'laptops' } },
        ],
      },
    ],
    error: null,
  })
);

const mockOrder = vi.fn(() => ({
  limit: mockLimit,
}));

const mockEqStatus = vi.fn(() => ({
  order: mockOrder,
}));

const mockEqMerchant = vi.fn(() => ({
  eq: mockEqStatus,
}));

const mockSelect = vi.fn(() => ({
  eq: mockEqMerchant,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    })
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(() =>
    Promise.resolve({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      site_description: 'Shop every gadget in one place.',
      logo_url: 'https://cdn.example.com/logo.png',
      custom_domain: 'ogabassey.com',
      payout_currency: 'NGN',
      slug: 'ogabassey',
    })
  ),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  })),
}));

vi.mock('@/components/storefront/ogabassey/pages/category-page', () => ({
  CategoryPage: ({
    products,
    seoHeading,
  }: {
    products: Array<{ name: string }>;
    seoHeading: string;
  }) => (
    <div data-testid="all-products-page">
      <h1>{seoHeading}</h1>
      <p>{products.map((product) => product.name).join(', ')}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => <div>Loading...</div>,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateCollectionPageSchema: vi.fn(() => ({ '@type': 'CollectionPage' })),
  generateBreadcrumbSchema: vi.fn(() => ({ '@type': 'BreadcrumbList' })),
}));

describe('All products route', () => {
  it('returns metadata for the products listing page', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.title).toBe('All Products | Ogabassey');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/products'
    );
  });

  it('renders the all products catalog with normalized products', async () => {
    const { default: AllProductsPage } = await import('./page');

    const result = await AllProductsPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    render(result as React.ReactElement);

    expect(screen.getByTestId('all-products-page')).toBeInTheDocument();
    expect(screen.getByText('All Products at Ogabassey')).toBeInTheDocument();
    expect(screen.getByText(/Legion Pro 7/)).toBeInTheDocument();
  });
});
