import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM } from '@/config/storefront-metadata-cache-bots';
import {
  getCachedCategories,
  getCachedCategoryPageData,
  getRequestScopedMerchant,
} from '@/lib/cached-data';

type CategoryPageProps = {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const {
  mockCategoryPageRoute,
  mockComparePageContent,
  mockGenerateCategoryMetadata,
} = vi.hoisted(() => ({
  mockCategoryPageRoute: vi.fn((_props: CategoryPageProps) => (
    <div>Compare category content</div>
  )),
  mockComparePageContent: vi.fn((_props: unknown) => (
    <div>Compare index content</div>
  )),
  mockGenerateCategoryMetadata: vi.fn(async (_props: CategoryPageProps) => ({
    title: 'Compare category metadata',
  })),
}));

const mockConnection = vi.hoisted(() => vi.fn());
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategories: vi.fn(),
  getCachedCategoryPageData: vi.fn(),
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { custom_domain?: string | null; slug: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('../[category]/page', () => ({
  default: (props: CategoryPageProps) => mockCategoryPageRoute(props),
  generateMetadata: (props: CategoryPageProps) =>
    mockGenerateCategoryMetadata(props),
}));

vi.mock('./compare-page-content', () => ({
  ComparePageContent: (props: unknown) => mockComparePageContent(props),
}));

type RequestScopedMerchant = NonNullable<
  Awaited<ReturnType<typeof getRequestScopedMerchant>>
>;
type CachedCategories = Awaited<ReturnType<typeof getCachedCategories>>;
type CategoryPageData = Awaited<ReturnType<typeof getCachedCategoryPageData>>;

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  site_title: 'Ogabassey',
  site_tagline: 'Devices and repairs',
  site_description: 'Shop devices and repairs.',
  business_type: 'electronics',
  logo_url: '',
  phone: '',
  email: 'support@ogabassey.com',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'free',
  premium_features: {},
  country: 'NG',
} satisfies RequestScopedMerchant;

const categories = [
  {
    id: 'category-1',
    name: 'Laptops',
    slug: 'laptops',
    description: null,
    image_url: null,
    is_active: true,
    parent_id: null,
  },
] satisfies CachedCategories;

const categoryPageData = {
  isCollection: false,
  category: null,
  fallbackDescription: 'Shop laptops.',
  fallbackName: 'Laptops',
  isInactiveCategory: false,
  products: [
    {
      id: 'macbook-air-15',
      name: '15" MacBook Air M4 (2025)',
      slug: 'macbook-air-15-inch-m4-2025',
      price: 2_000_000,
      category: 'Laptops',
      brand: 'Apple',
      product_key_specs: {
        chipset: 'Apple M4',
        ram_gb: 16,
        screen_size_inches: 15,
        storage_gb: 512,
      },
    },
    {
      id: 'dell-xps-13',
      name: 'Dell XPS 13 9350',
      slug: 'dell-xps-13-9350',
      price: 900_000,
      category: 'Laptops',
      brand: 'Dell',
      product_key_specs: {
        chipset: 'Intel Core Ultra 7',
        ram_gb: 32,
        screen_size_inches: 13,
        storage_gb: 1024,
      },
    },
  ],
} satisfies CategoryPageData;

const { default: CompareIndexPage, generateMetadata } = await import('./page');

describe('compare index page', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getCachedCategories).mockReset();
    vi.mocked(getCachedCategoryPageData).mockReset();
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(merchant);
    vi.mocked(getCachedCategories).mockResolvedValue(categories);
    vi.mocked(getCachedCategoryPageData).mockResolvedValue(categoryPageData);
    mockComparePageContent.mockReset();
    mockComparePageContent.mockImplementation(() => (
      <div>Compare index content</div>
    ));
    mockCategoryPageRoute.mockReset();
    mockCategoryPageRoute.mockImplementation(() => (
      <div>Compare category content</div>
    ));
    mockGenerateCategoryMetadata.mockReset();
    mockGenerateCategoryMetadata.mockResolvedValue({
      title: 'Compare category metadata',
    });
    mockConnection.mockReset();
    mockNotFound.mockClear();
  });

  it('defers compare index first paint to the route loader while content is pending', () => {
    mockComparePageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Keep content suspended behind the catalog loader.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        <CompareIndexPage params={Promise.resolve({ slug: 'ogabassey' })} />
      </Suspense>
    );

    expect(
      screen.getByRole('status', { name: 'Loading product listing' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Compare index content')).not.toBeInTheDocument();
  });

  it('emits indexable canonical metadata for the compare index', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.title).toBe('Compare products | Ogabassey');
    expect(metadata.alternates).toMatchObject({
      canonical: 'https://ogabassey.com/compare',
    });
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
  });

  it('keeps the compare index indexable for internal metadata cache bucket requests', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({
        [STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM]: 'metadata-blocking',
      }),
    });

    expect(metadata.alternates).toMatchObject({
      canonical: 'https://ogabassey.com/compare',
    });
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
  });

  it('returns noindex metadata for parameterized compare hub URLs', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({
        brand: 'Apple',
        search: 'iphone',
      }),
    });

    expect(metadata.alternates).toMatchObject({
      canonical: 'https://ogabassey.com/compare',
    });
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });

  it('delegates metadata to the category page when the merchant owns a compare category', async () => {
    vi.mocked(getCachedCategories).mockResolvedValueOnce([
      ...categories,
      {
        id: 'category-compare',
        name: 'Compare',
        slug: ' Compare ',
        description: null,
        image_url: null,
        is_active: true,
        parent_id: null,
      },
    ]);

    const searchParams = Promise.resolve({
      page: '2',
      sort: 'price-asc',
    });
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams,
    });

    expect(metadata.title).toBe('Compare category metadata');
    expect(mockGenerateCategoryMetadata).toHaveBeenCalledTimes(1);
    const categoryProps = mockGenerateCategoryMetadata.mock.calls[0]?.[0];

    if (!categoryProps) {
      throw new Error('Expected category metadata props');
    }

    await expect(categoryProps.params).resolves.toEqual({
      slug: 'ogabassey',
      category: 'compare',
    });
    await expect(categoryProps.searchParams).resolves.toEqual({
      page: '2',
      sort: 'price-asc',
    });
    expect(getCachedCategoryPageData).not.toHaveBeenCalled();
  });

  it('uses the compare hub when the merchant compare category is inactive', async () => {
    vi.mocked(getCachedCategories).mockResolvedValueOnce([
      ...categories,
      {
        id: 'category-compare',
        name: 'Compare',
        slug: 'compare',
        description: null,
        image_url: null,
        is_active: false,
        parent_id: null,
      },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.title).toBe('Compare products | Ogabassey');
    expect(mockGenerateCategoryMetadata).not.toHaveBeenCalled();
    expect(getCachedCategoryPageData).toHaveBeenCalled();
  });

  it('returns noindex metadata when the compare index has no eligible sections', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      products: [],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.alternates).toMatchObject({
      canonical: 'https://ogabassey.com/compare',
    });
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });

  it('returns noindex metadata when the storefront merchant is missing', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-storefront' }),
    });

    expect(metadata.title).toBe('Compare products page not found');
    expect(metadata.alternates).toBeNull();
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });

  it('calls notFound for invalid storefront identifiers', async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'images' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
