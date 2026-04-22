import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_HUB_DEFAULTS } from '@/config/category-hub-defaults';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import type { CategoryHubModel } from '@/lib/storefront-category/category-hub-types';

const NORMALIZED_PLACEHOLDER_IMAGE =
  'https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image';
const mockGetPublishedClusterPosts = vi.fn();

const categoryPageSpy = vi.fn(
  ({
    currentPage,
    hubContent,
  }: {
    currentPage?: number;
    hubContent?: CategoryHubModel;
  }) => (
    <div>
      <div>Current page: {currentPage}</div>
      <div>Hub heading: {hubContent?.intro.heading ?? 'none'}</div>
      {hubContent?.bestForCards.map((card) => (
        <div key={`best-for-${card.title}-${card.href}`}>
          Best for: {card.title}
        </div>
      ))}
      {hubContent?.brandCards.map((card) => (
        <div key={`brand-${card.title}-${card.href}`}>
          <div>Brand: {card.title}</div>
          {card.secondaryLabel ? (
            <div>Brand compare: {card.secondaryLabel}</div>
          ) : null}
        </div>
      ))}
      {hubContent?.priceBandCards.map((card) => (
        <div key={`price-band-${card.title}-${card.href}`}>
          Price band: {card.title}
        </div>
      ))}
      {hubContent?.comparisonLinks.map((link) => (
        <div key={`compare-link-${link.label}-${link.href}`}>
          Compare link: {link.label}
        </div>
      ))}
      {hubContent?.guideLinks.map((link) => (
        <div key={`guide-link-${link.title}-${link.href}`}>
          Guide link: {link.title}
        </div>
      ))}
      {hubContent?.faqItems.map((item) => (
        <div key={`faq-${item.question}-${item.answer}`}>
          FAQ: {item.question}
        </div>
      ))}
    </div>
  )
);
const mockBuildStoreUrl = vi.fn();
const mockBuildRequestScopedStoreUrl = vi.fn();
const mockGenerateBreadcrumbSchema = vi.fn(() => ({}));
const mockGenerateCollectionPageSchema = vi.fn(() => ({}));
const mockGenerateFAQSchema = vi.fn((faqItems) => ({
  '@type': 'FAQPage',
  mainEntity: faqItems,
}));

vi.mock('@/components/storefront/ogabassey/pages/category-page', () => ({
  CategoryPage: (props: {
    currentPage?: number;
    hubContent?: CategoryHubModel;
  }) => categoryPageSpy(props),
}));

vi.mock(
  '@/components/storefront/ogabassey/seo/commercial-support-links',
  () => ({
    CommercialSupportLinks: () => <div>CommercialSupportLinks footer</div>,
  })
);

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => <div>Loading...</div>,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: vi.fn(),
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
  getMerchantByIdentifier: vi.fn(),
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
    product_key_specs?: Record<string, unknown> | null;
    category_slug?: string | null;
  }) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    price: product.price,
    image: product.image || product.images?.[0] || NORMALIZED_PLACEHOLDER_IMAGE,
    images: product.images ?? [product.image],
    category: product.category ?? 'Smartphones',
    brand: product.brand ?? null,
    condition: product.condition ?? 'new',
    stock: product.stock ?? 0,
    product_key_specs: product.product_key_specs ?? null,
    category_slug: product.category_slug ?? 'smartphones',
  }),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/lib/seo-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/seo-utils')>();

  return {
    ...actual,
    generateBreadcrumbSchema: (
      ...args: Parameters<typeof mockGenerateBreadcrumbSchema>
    ) => mockGenerateBreadcrumbSchema(...args),
    generateCollectionPageSchema: (
      ...args: Parameters<typeof mockGenerateCollectionPageSchema>
    ) => mockGenerateCollectionPageSchema(...args),
    generateFAQSchema: (...args: Parameters<typeof mockGenerateFAQSchema>) =>
      mockGenerateFAQSchema(...args),
    generateMetaDescription: (description: string) =>
      description.replace(/<[^>]+>/g, '').trim(),
    getIndexableRobotsMetadata: () => ({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    }),
  };
});

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (...args: unknown[]) => mockBuildStoreUrl(...args),
  buildRequestScopedStoreUrl: (...args: unknown[]) =>
    mockBuildRequestScopedStoreUrl(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
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
  logo_url: null,
};

function makeSmartphoneProduct(
  index: number,
  overrides: Partial<{
    name: string;
    slug: string;
    brand: string;
    price: number;
    main_camera_mp: number;
    battery_mah: number;
    charging_watt: number;
    ram_gb: number;
    storage_gb: number;
    screen_size_inches: number;
  }> = {}
) {
  return {
    id: `product-${index}`,
    name: overrides.name ?? `Phone ${index}`,
    slug: overrides.slug ?? `phone-${index}`,
    description: `Description ${index}`,
    price: overrides.price ?? 300000 + index * 1000,
    image: `https://cdn.example.com/product-${index}.png`,
    images: [`https://cdn.example.com/product-${index}.png`],
    category: 'Smartphones',
    brand: overrides.brand ?? 'Tecno',
    condition: 'new',
    stock: 5,
    category_slug: 'smartphones',
    product_key_specs: {
      main_camera_mp: overrides.main_camera_mp ?? 48,
      battery_mah: overrides.battery_mah ?? 5000,
      charging_watt: overrides.charging_watt ?? 33,
      ram_gb: overrides.ram_gb ?? 8,
      storage_gb: overrides.storage_gb ?? 128,
      screen_size_inches: overrides.screen_size_inches ?? 6.6,
    },
  };
}

const smartphoneHubProducts = [
  makeSmartphoneProduct(1, {
    name: 'Alpha Phone',
    slug: 'alpha-phone',
    brand: 'Apple',
    price: 420000,
    main_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 33,
  }),
  makeSmartphoneProduct(2, {
    name: 'Beta Phone',
    slug: 'beta-phone',
    brand: 'Samsung',
    price: 460000,
    main_camera_mp: 64,
    battery_mah: 6000,
    charging_watt: 45,
    ram_gb: 12,
    storage_gb: 256,
  }),
  makeSmartphoneProduct(3, {
    name: 'Apple Mini',
    slug: 'apple-mini',
    brand: 'Apple',
    price: 390000,
    main_camera_mp: 48,
    battery_mah: 4700,
  }),
  makeSmartphoneProduct(4, {
    name: 'Apple Pro',
    slug: 'apple-pro',
    brand: 'Apple',
    price: 490000,
    main_camera_mp: 108,
    battery_mah: 6000,
    charging_watt: 45,
    ram_gb: 12,
    storage_gb: 256,
  }),
  makeSmartphoneProduct(5, {
    name: 'Samsung A',
    slug: 'samsung-a',
    brand: 'Samsung',
    price: 350000,
    main_camera_mp: 48,
    battery_mah: 5000,
  }),
  makeSmartphoneProduct(6, {
    name: 'Samsung B',
    slug: 'samsung-b',
    brand: 'Samsung',
    price: 480000,
    main_camera_mp: 50,
    battery_mah: 5000,
  }),
  makeSmartphoneProduct(7, {
    name: 'Tecno C',
    slug: 'tecno-c',
    brand: 'Tecno',
    price: 470000,
    main_camera_mp: 32,
    battery_mah: 5000,
  }),
  makeSmartphoneProduct(8, {
    name: 'Tecno Spark',
    slug: 'tecno-spark',
    brand: 'Tecno',
    price: 220000,
  }),
  makeSmartphoneProduct(9, {
    name: 'Infinix Zero',
    slug: 'infinix-zero',
    brand: 'Infinix',
    price: 240000,
    charging_watt: 45,
  }),
  makeSmartphoneProduct(10, {
    name: 'Xiaomi Redmi',
    slug: 'xiaomi-redmi',
    brand: 'Xiaomi',
    price: 260000,
    battery_mah: 5100,
  }),
  makeSmartphoneProduct(11, {
    name: 'Nokia G',
    slug: 'nokia-g',
    brand: 'Nokia',
    price: 280000,
    main_camera_mp: 50,
  }),
  makeSmartphoneProduct(12, {
    name: 'Itel Vision',
    slug: 'itel-vision',
    brand: 'Itel',
    price: 180000,
    battery_mah: 5000,
  }),
  makeSmartphoneProduct(13, {
    name: 'Oppo Reno',
    slug: 'oppo-reno',
    brand: 'Oppo',
    price: 620000,
    main_camera_mp: 50,
    charging_watt: 65,
    ram_gb: 12,
    storage_gb: 256,
  }),
  makeSmartphoneProduct(14, {
    name: 'Vivo V',
    slug: 'vivo-v',
    brand: 'Vivo',
    price: 710000,
    main_camera_mp: 64,
    battery_mah: 5000,
    charging_watt: 66,
  }),
  makeSmartphoneProduct(15, {
    name: 'Pixel Prime',
    slug: 'pixel-prime',
    brand: 'Google',
    price: 890000,
    main_camera_mp: 50,
    battery_mah: 5000,
    ram_gb: 12,
    storage_gb: 256,
  }),
  makeSmartphoneProduct(16, {
    name: 'Motorola Edge',
    slug: 'motorola-edge',
    brand: 'Motorola',
    price: 530000,
    charging_watt: 68,
  }),
  makeSmartphoneProduct(17, {
    name: 'Honor Magic',
    slug: 'honor-magic',
    brand: 'Honor',
    price: 580000,
    main_camera_mp: 54,
    battery_mah: 5100,
    charging_watt: 66,
  }),
  makeSmartphoneProduct(18, {
    name: 'Huawei Nova',
    slug: 'huawei-nova',
    brand: 'Huawei',
    price: 640000,
    main_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 66,
  }),
  makeSmartphoneProduct(19, {
    name: 'Realme GT',
    slug: 'realme-gt',
    brand: 'Realme',
    price: 520000,
    battery_mah: 5000,
    charging_watt: 80,
  }),
  makeSmartphoneProduct(20, {
    name: 'OnePlus Ace',
    slug: 'oneplus-ace',
    brand: 'OnePlus',
    price: 760000,
    main_camera_mp: 50,
    battery_mah: 5100,
    charging_watt: 100,
  }),
  makeSmartphoneProduct(21, {
    name: 'Nothing Phone',
    slug: 'nothing-phone',
    brand: 'Nothing',
    price: 690000,
    main_camera_mp: 50,
    battery_mah: 4700,
    charging_watt: 45,
  }),
];

const headphoneProducts = [
  {
    ...makeSmartphoneProduct(31, {
      name: 'Sony Headphone',
      slug: 'sony-headphone',
      brand: 'Sony',
      price: 45000,
    }),
    category: 'Headphones',
    category_slug: 'headphones',
  },
  {
    ...makeSmartphoneProduct(32, {
      name: 'Anker Headphone',
      slug: 'anker-headphone',
      brand: 'Anker',
      price: 55000,
    }),
    category: 'Headphones',
    category_slug: 'headphones',
  },
  {
    ...makeSmartphoneProduct(33, {
      name: 'JBL Headphone',
      slug: 'jbl-headphone',
      brand: 'JBL',
      price: 65000,
    }),
    category: 'Headphones',
    category_slug: 'headphones',
  },
  {
    ...makeSmartphoneProduct(34, {
      name: 'Nokia Headphone',
      slug: 'nokia-headphone',
      brand: 'Nokia',
      price: 75000,
    }),
    category: 'Headphones',
    category_slug: 'headphones',
  },
];

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
  products: smartphoneHubProducts,
  isCollection: false,
  fallbackName: 'Smartphones',
  fallbackDescription: 'Shop smartphones',
  seo: null,
  name: null,
};

const { generateMetadata } = await import('./page');
const { CategoryPageContent } = await import('./category-page-content');

function getLastHubContent() {
  const lastCall = categoryPageSpy.mock.calls.at(-1)?.[0] as
    | { hubContent?: CategoryHubModel }
    | undefined;
  return lastCall?.hubContent;
}

function getLastCategoryPageProps() {
  return categoryPageSpy.mock.calls.at(-1)?.[0] as
    | {
        products?: Array<{ condition?: string }>;
        hubContent?: CategoryHubModel;
      }
    | undefined;
}

describe('category page route', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    vi.mocked(getMerchantByIdentifier).mockReset();
    vi.mocked(getCachedCategoryPageData).mockReset();
    categoryPageSpy.mockClear();
    notFound.mockClear();
    mockGenerateBreadcrumbSchema.mockClear();
    mockGenerateCollectionPageSchema.mockClear();
    mockGenerateFAQSchema.mockClear();
    mockGetPublishedClusterPosts.mockReset();

    vi.mocked(getCachedMerchant).mockResolvedValue(
      merchant as unknown as Awaited<ReturnType<typeof getCachedMerchant>>
    );
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(
      merchant as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>
    );
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockBuildStoreUrl.mockReset();
    mockBuildStoreUrl.mockImplementation(
      (mockMerchant: { slug: string; custom_domain?: string | null }) =>
        mockMerchant.custom_domain
          ? `https://${mockMerchant.custom_domain}`
          : `https://${mockMerchant.slug}.usebaci.com`
    );
    mockBuildRequestScopedStoreUrl.mockReset();
    mockBuildRequestScopedStoreUrl.mockImplementation(
      (mockMerchant: { slug: string; custom_domain?: string | null }) =>
        mockMerchant.custom_domain
          ? `https://${mockMerchant.custom_domain}`
          : `https://${mockMerchant.slug}.usebaci.com`
    );
    vi.mocked(getCachedCategoryPageData).mockResolvedValue(
      categoryPageData as unknown as Awaited<
        ReturnType<typeof getCachedCategoryPageData>
      >
    );
    mockGetPublishedClusterPosts.mockResolvedValue([
      {
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        excerpt: 'Budget and flagship picks.',
        category: 'Smartphones',
        tags: ['smartphones', 'budget'],
        keywords: ['android'],
        featured_image_url: null,
        published_at: '2026-04-10T09:00:00.000Z',
        reading_time_minutes: 6,
      },
    ]);
  });

  it('renders curated smartphone hub content when merchant-authored SEO is absent', async () => {
    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(await screen.findByText('Current page: 1')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Hub heading: ${CATEGORY_HUB_DEFAULTS.smartphones.intro.heading}`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Best for: Best for Photography')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Best for: Best for Battery Life')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Best for: Best Budget Phones')
    ).toBeInTheDocument();
    expect(screen.getByText('Brand: Apple')).toBeInTheDocument();
    expect(screen.getByText('Brand: Samsung')).toBeInTheDocument();
    expect(screen.getByText('Brand: Tecno')).toBeInTheDocument();
    expect(
      screen.getByText('Price band: Best Smartphones Under ₦500,000')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Price band: Best Smartphones Under ₦1,000,000')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Compare link: Alpha Phone vs Beta Phone')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Compare link: Apple vs Samsung')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Compare link: Best Smartphones Under ₦500,000')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `FAQ: ${CATEGORY_HUB_DEFAULTS.smartphones.faqItems[0].question}`
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Brand compare: Compare Apple vs Samsung')
    ).toHaveLength(2);
    expect(
      screen.queryByText('CommercialSupportLinks footer')
    ).not.toBeInTheDocument();
  });

  it('prefers merchant-authored intro and faq over curated smartphone defaults', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      category: {
        ...categoryPageData.category,
        seo_heading: 'Shop curated smartphones for creators',
        seo_description: 'Merchant-authored smartphone intro copy.',
        seo_features: ['Merchant-backed warranty', 'Fast creator delivery'],
        seo_faq: [
          {
            question: 'Do these phones support eSIM?',
            answer: 'Selected models support eSIM.',
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(
      await screen.findByText(
        'Hub heading: Shop curated smartphones for creators'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('FAQ: Do these phones support eSIM?')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        `FAQ: ${CATEGORY_HUB_DEFAULTS.smartphones.faqItems[0].question}`
      )
    ).not.toBeInTheDocument();
    expect(getLastHubContent()?.trustFeatures).toEqual([
      'Merchant-backed warranty',
      'Fast creator delivery',
    ]);
    expect(
      screen.getByText('Best for: Best for Photography')
    ).toBeInTheDocument();
  });

  it('keeps collection intro and faq while omitting hub cards and compare support', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      isCollection: true,
      name: 'Refurbished Smartphones',
      seo: {
        heading: 'Certified refurbished smartphones in Lagos',
        description: 'Collection intro managed by the merchant.',
        features: ['Collection warranty', 'Tested before dispatch'],
        faqs: [
          {
            question: 'Are refurbished phones tested?',
            answer: 'Yes, before dispatch.',
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(
      await screen.findByText(
        'Hub heading: Certified refurbished smartphones in Lagos'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('FAQ: Are refurbished phones tested?')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Best for: Best for Photography')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Brand: Apple')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Price band: Best Smartphones Under ₦500,000')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Compare link: Apple vs Samsung')
    ).not.toBeInTheDocument();
    expect(getLastHubContent()?.trustFeatures).toEqual([
      'Collection warranty',
      'Tested before dispatch',
    ]);
    expect(
      screen.queryByText('CommercialSupportLinks footer')
    ).not.toBeInTheDocument();
  });

  it('renders non-priority category intro, features, and faq without hub cards', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      category: {
        ...categoryPageData.category,
        name: 'Headphones',
        slug: 'headphones',
        seo_heading: 'Buy headphones with clear fit guidance',
        seo_description: 'Merchant-authored copy for headphones.',
        seo_features: ['Noise-cancelling picks', 'Fast delivery'],
        seo_faq: [
          {
            question: 'Which headphones are best for calls?',
            answer: 'Focus on mic quality and comfort.',
          },
        ],
      },
      products: headphoneProducts,
      fallbackName: 'Headphones',
      fallbackDescription: 'Shop headphones',
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'headphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(
      await screen.findByText(
        'Hub heading: Buy headphones with clear fit guidance'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('FAQ: Which headphones are best for calls?')
    ).toBeInTheDocument();
    expect(getLastHubContent()?.trustFeatures).toEqual([
      'Noise-cancelling picks',
      'Fast delivery',
    ]);
    expect(
      screen.queryByText('Best for: Best for Photography')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Brand: Apple')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Price band: Best Smartphones Under ₦500,000')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Compare link: Apple vs Samsung')
    ).not.toBeInTheDocument();
  });

  it('uses the request-scoped storefront host for category hub links', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['host', 'preview-ogabassey.vercel.app']])
    );
    mockBuildRequestScopedStoreUrl.mockReturnValue(
      'https://preview-ogabassey.vercel.app'
    );

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    const hubContent = getLastHubContent();

    expect(hubContent?.bestForCards[0]?.href).toContain(
      'https://preview-ogabassey.vercel.app/'
    );
    expect(hubContent?.brandCards[0]?.href).toContain(
      'https://preview-ogabassey.vercel.app/'
    );
    expect(hubContent?.priceBandCards[0]?.href).toContain(
      'https://preview-ogabassey.vercel.app/'
    );
    expect(hubContent?.comparisonLinks[0]?.href).toContain(
      'https://preview-ogabassey.vercel.app/'
    );
    expect(hubContent?.guideLinks[0]?.href).toContain(
      'https://preview-ogabassey.vercel.app/'
    );
  });

  it('uses hub intro copy for metadata title and descriptions', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(typeof metadata.title).toBe('string');
    expect((metadata.title as string).length).toBeLessThanOrEqual(70);
    expect(metadata.title).not.toContain('| Ogabassey | Ogabassey');
    expect(metadata.description).toBe(
      CATEGORY_HUB_DEFAULTS.smartphones.intro.description
    );
    expect(metadata.openGraph?.description).toBe(
      CATEGORY_HUB_DEFAULTS.smartphones.intro.description
    );
    expect(metadata.twitter?.description).toBe(
      CATEGORY_HUB_DEFAULTS.smartphones.intro.description
    );
  });

  it('preserves the paginated metadata contract with hub-derived titles', async () => {
    const firstPageMetadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });
    const secondPageMetadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(firstPageMetadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/smartphones'
    );
    expect(secondPageMetadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/smartphones?page=2'
    );
    expect(typeof secondPageMetadata.title).toBe('string');
    expect(secondPageMetadata.title).toContain('Page 2');
    expect((secondPageMetadata.title as string).length).toBeLessThanOrEqual(70);
    expect(secondPageMetadata.title).not.toContain('| Ogabassey | Ogabassey');
    expect(secondPageMetadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/product-21.png',
        alt: 'Smartphones',
      },
    ]);
    expect(secondPageMetadata.twitter?.images).toEqual([
      'https://cdn.example.com/product-21.png',
    ]);
  });

  it('uses hub faq items for FAQ JSON-LD', async () => {
    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(mockGenerateFAQSchema).toHaveBeenCalledWith(
      CATEGORY_HUB_DEFAULTS.smartphones.faqItems
    );
  });

  it('passes normalized category products into collection schema generation', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      products: [
        {
          ...smartphoneHubProducts[0],
          image: '',
          images: ['https://cdn.example.com/normalized-phone.png'],
          category: null,
          category_slug: 'smartphones',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(mockGenerateCollectionPageSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        products: [
          expect.objectContaining({
            image: 'https://cdn.example.com/normalized-phone.png',
            category_slug: 'smartphones',
            price: 420000,
          }),
        ],
      })
    );
  });

  it('preserves refurbished condition in category page products', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      products: [
        {
          ...smartphoneHubProducts[0],
          condition: 'refurbished',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof getCachedCategoryPageData>>);

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'test-store', category: 'smartphones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(getLastCategoryPageProps()?.products?.[0]?.condition).toBe(
      'refurbished'
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

  it('falls back to the normalized placeholder image when the category page has no product media', async () => {
    vi.mocked(getCachedCategoryPageData).mockResolvedValueOnce({
      ...categoryPageData,
      products: [
        {
          ...smartphoneHubProducts[0],
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
        url: NORMALIZED_PLACEHOLDER_IMAGE,
        alt: 'Smartphones',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([NORMALIZED_PLACEHOLDER_IMAGE]);
  });
});
