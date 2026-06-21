import { vi } from 'vitest';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { getCachedBlogListing } from '@/lib/cached-data';

interface MockDefaultBlogUiProps {
  blogSchema: {
    publisher?: {
      '@id'?: string;
    };
    blogPost?: unknown;
  };
  itemListSchema?: {
    '@type'?: string;
    numberOfItems?: number;
    url?: string;
    itemListElement?: Array<{
      '@type'?: string;
      position?: number;
      url?: string;
      name?: string;
    }>;
  };
  categories: string[];
  merchant: { business_name: string };
  posts: Array<{ slug: string; title: string }>;
  totalPosts: number;
  currentPage?: number;
}

interface MockTemplateBlogRendererProps {
  itemListSchema?: MockDefaultBlogUiProps['itemListSchema'];
}

const hoistedMocks = vi.hoisted(() => ({
  mockBuildBlogClusterCollections: vi.fn(),
  mockDefaultBlogUi: vi.fn((props: MockDefaultBlogUiProps) => (
    <div>{props.merchant.business_name} blog</div>
  )),
  mockGetTemplate: vi.fn<(...args: unknown[]) => unknown>(() => null),
  mockHeaders: vi.fn(() => new Headers()),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  mockTemplateBlogRenderer: vi.fn((_props: MockTemplateBlogRendererProps) => (
    <div>Template blog</div>
  )),
}));

export const {
  mockBuildBlogClusterCollections,
  mockDefaultBlogUi,
  mockGetTemplate,
  mockHeaders,
  mockNotFound,
  mockRedirect,
  mockTemplateBlogRenderer,
} = hoistedMocks;

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
  generateMetaDescription: vi.fn((description: string) => description),
  generateSlug: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/blog-organization-schema', () => ({
  buildBlogOrganizationSchema: vi.fn(() => ({
    '@id': 'https://test-store.usebaci.com#organization',
    '@type': 'OnlineStore',
  })),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: {
    slug: string;
    custom_domain?: string | null;
    store_url?: string;
  }) =>
    merchant.store_url
      ? merchant.store_url
      : merchant.custom_domain
        ? `https://${merchant.custom_domain}`
        : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

vi.mock('@/lib/storefront-content/build-blog-cluster-collections', () => ({
  buildBlogClusterCollections: (...args: unknown[]) =>
    mockBuildBlogClusterCollections(...args),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: (templateId: unknown) => mockGetTemplate(templateId),
}));

vi.mock('./default-blog-ui', () => ({
  DefaultBlogUi: (props: MockDefaultBlogUiProps) => mockDefaultBlogUi(props),
}));

vi.mock('./template-blog-renderer', () => ({
  TemplateBlogRenderer: (props: MockTemplateBlogRendererProps) =>
    mockTemplateBlogRenderer(props),
}));

vi.mock('./blog-listing-pagination', () => ({
  BlogListingPagination: (props: {
    storeBasePath: string;
    category?: string;
    currentPage: number;
    search?: string;
    totalPages: number;
  }) => (
    <div
      data-testid="blog-pagination"
      data-store-base-path={props.storeBasePath}
      data-category={props.category}
      data-current-page={props.currentPage}
      data-search={props.search}
      data-total-pages={props.totalPages}
    />
  ),
}));

export const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  slug: 'test-store',
  custom_domain: undefined as string | undefined,
  store_url: undefined as string | undefined,
  logo_url: '',
  template_id: 'ogabassey',
  country: 'NG' as string | undefined,
  social_media: { instagram: '@ogabassey' } as
    | { instagram?: string; facebook?: string; twitter?: string }
    | undefined,
};

export const postsPayload = [
  {
    id: 'post-1',
    title: 'First Post',
    slug: 'first-post',
    excerpt: 'Latest store updates',
    featured_image_url: 'https://cdn.example.com/blog-cover.png',
    featured_image_variants: {
      landscape_16x9: 'https://cdn.example.com/blog-cover-16x9.png',
      standard_4x3: 'https://cdn.example.com/blog-cover-4x3.png',
      square_1x1: 'https://cdn.example.com/blog-cover-1x1.png',
    },
    featured_image_alt: 'First Post cover',
    category: 'News',
    tags: ['launch'],
    author_name: 'Ogabassey',
    published_at: '2026-03-28T10:00:00.000Z',
    reading_time_minutes: 4,
    view_count: 10,
  },
];

export const clusterCollections = [
  {
    categorySlug: 'smartphones',
    heading: 'Smartphone buying guides',
    categoryHref: 'https://ogabassey.com/smartphones',
    guides: [
      {
        href: 'https://ogabassey.com/blog/best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        description: 'Budget and flagship picks.',
        kind: 'best-in-nigeria' as const,
      },
      {
        href: 'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
        title: 'Apple vs Samsung Buying Guide',
        description: 'Which ecosystem fits you.',
        kind: 'decision-support' as const,
      },
    ],
  },
];

export function buildListingResult(
  overrides?: Partial<{
    merchant: typeof merchant;
    posts: typeof postsPayload;
    totalPosts: number;
  }>
) {
  const posts = overrides?.posts ?? postsPayload;
  const totalPosts = overrides?.totalPosts ?? posts.length;
  return {
    merchant: overrides?.merchant ?? merchant,
    posts,
    totalPosts,
    categories: ['News', 'gcrblw'],
    currentPage: 1,
    totalPages: Math.ceil(totalPosts / BLOG_LISTING_PAGE_SIZE),
    searchQuery: undefined,
  };
}

export const mockGetCachedBlogListing = vi.mocked(getCachedBlogListing);

export function resetBlogPageContentMocks() {
  mockGetCachedBlogListing.mockReset();
  mockGetCachedBlogListing.mockResolvedValue(buildListingResult());
  mockNotFound.mockClear();
  mockRedirect.mockClear();
  mockHeaders.mockReset();
  mockHeaders.mockReturnValue(new Headers());
  mockBuildBlogClusterCollections.mockReset();
  mockBuildBlogClusterCollections.mockReturnValue([]);
  mockDefaultBlogUi.mockReset();
  mockDefaultBlogUi.mockImplementation((props: MockDefaultBlogUiProps) => (
    <div>{props.merchant.business_name} blog</div>
  ));
  mockGetTemplate.mockReset();
  mockGetTemplate.mockReturnValue(null);
  mockTemplateBlogRenderer.mockReset();
  mockTemplateBlogRenderer.mockImplementation(
    (_props: MockTemplateBlogRendererProps) => <div>Template blog</div>
  );
}

export type { MockDefaultBlogUiProps, MockTemplateBlogRendererProps };
