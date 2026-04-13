import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

const categoryPageSpy = vi.fn(({ currentPage }: { currentPage?: number }) => (
  <div>Category page {currentPage}</div>
));

vi.mock('@/components/storefront/ogabassey/pages/category-page', () => ({
  CategoryPage: (props: { currentPage?: number }) => categoryPageSpy(props),
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => <div>Loading...</div>,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: vi.fn(),
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
}));

vi.mock('@/lib/normalize-product', () => ({
  normalizeProduct: (product: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    price: number;
    image: string;
    images?: string[];
    category?: string | null;
    brand?: string | null;
    condition?: string | null;
    stock?: number | null;
  }) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    price: product.price,
    image: product.image,
    images: product.images ?? [product.image],
    category: product.category ?? 'Smartphones',
    brand: product.brand ?? null,
    condition: product.condition ?? 'new',
    stock: product.stock ?? 0,
  }),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
  generateCollectionPageSchema: vi.fn(() => ({})),
  generateFAQSchema: vi.fn(() => ({})),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  slug: 'test-store',
  custom_domain: null,
  payout_currency: 'NGN',
  site_description: 'Store description',
};

const products = Array.from({ length: 21 }, (_, index) => ({
  id: `product-${index + 1}`,
  name: `Product ${index + 1}`,
  slug: `product-${index + 1}`,
  description: `Description ${index + 1}`,
  price: 100000 + index,
  image: `https://cdn.example.com/product-${index + 1}.png`,
  images: [`https://cdn.example.com/product-${index + 1}.png`],
  category: 'Smartphones',
  brand: 'Apple',
  condition: 'new',
  stock: 5,
}));

const categoryPageData = {
  category: {
    id: 'cat-1',
    name: 'Smartphones',
    slug: 'smartphones',
    seo_heading: null,
    seo_description: null,
    seo_features: [],
    seo_faq: [],
    image_url: null,
    parent: null,
  },
  products,
  isCollection: false,
  fallbackName: 'Smartphones',
  fallbackDescription: 'Shop smartphones',
  seo: null,
  name: null,
};

const {
  default: CategoryPageRoute,
  CategoryPageContent,
  generateMetadata,
} = await import('./page');

describe('category page route', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    vi.mocked(getCachedCategoryPageData).mockReset();
    categoryPageSpy.mockClear();
    notFound.mockClear();

    vi.mocked(getCachedMerchant).mockResolvedValue(
      merchant as unknown as Awaited<ReturnType<typeof getCachedMerchant>>
    );
    vi.mocked(getCachedCategoryPageData).mockResolvedValue(
      categoryPageData as unknown as Awaited<
        ReturnType<typeof getCachedCategoryPageData>
      >
    );
  });

  it('passes the current page through to the category page component', async () => {
    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    render(ui);

    expect(await screen.findByText('Category page 2')).toBeInTheDocument();
    expect(categoryPageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPage: 2,
        itemsPerPage: 20,
      })
    );
  });

  it('uses a self-referencing canonical on paginated category pages', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/smartphones?page=2'
    );
    expect(metadata.title).toBe('Smartphones - Page 2 | Ogabassey');
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/product-21.png',
        alt: 'Smartphones',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/product-21.png',
    ]);
  });

  it('omits ?page=1 from the first category page canonical URL', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/smartphones'
    );
  });

  it('returns notFound for out-of-range category pages', async () => {
    const outOfRangePage = CategoryPageContent({
      params: Promise.resolve({
        slug: 'test-store',
        category: 'smartphones',
      }),
      searchParams: Promise.resolve({ page: '3' }),
    });

    await expect(outOfRangePage).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('falls back to the storefront opengraph image when the category page has no product media', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      products: [
        {
          ...products[0],
          image: '',
          images: [],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://test-store.usebaci.com/opengraph-image',
        alt: 'Smartphones',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://test-store.usebaci.com/opengraph-image',
    ]);
  });
});
