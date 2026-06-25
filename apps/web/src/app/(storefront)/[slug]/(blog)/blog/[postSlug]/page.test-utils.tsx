import { vi } from 'vitest';

const pageMockState = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
  mockCacheTag: vi.fn(),
  mockBlogPostPageContent: vi.fn((_props: unknown) => (
    <div>Blog post page content</div>
  )),
  mockBlogPostExistenceMaybeSingle: vi.fn(),
  mockBlogPostExistenceSelect: vi.fn(),
  mockBlogPostExistenceFrom: vi.fn(),
  mockCreatePublicClient: vi.fn(),
  mockBuildStoreUrl: vi.fn(
    (merchant: { slug: string; custom_domain?: string | null }) =>
      merchant.custom_domain
        ? `https://${merchant.custom_domain}`
        : `https://${merchant.slug}.usebaci.com`
  ),
  mockGetBlogPostRedirect: vi.fn(),
  mockGetBlogPostTextPreview: vi.fn<(content: unknown) => string>(
    () => 'Preview text'
  ),
  mockGetCachedFeatureSettings: vi.fn(),
  mockPermanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
  }),
  mockDraftMode: vi.fn(),
  mockHeaders: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockGetCachedBlogPost: vi.fn(),
  mockGetLiveBlogPost: vi.fn(),
  mockGetMerchantSafe: vi.fn(),
  mockConnection: vi.fn(),
}));

export const mockCacheLife = pageMockState.mockCacheLife;
export const mockCacheTag = pageMockState.mockCacheTag;
export const mockBlogPostPageContent = pageMockState.mockBlogPostPageContent;
export const mockBlogPostExistenceMaybeSingle =
  pageMockState.mockBlogPostExistenceMaybeSingle;
export const mockBuildStoreUrl = pageMockState.mockBuildStoreUrl;
export const mockCreatePublicClient = pageMockState.mockCreatePublicClient;
export const mockGetBlogPostRedirect = pageMockState.mockGetBlogPostRedirect;
export const mockGetBlogPostTextPreview =
  pageMockState.mockGetBlogPostTextPreview;
export const mockGetCachedFeatureSettings =
  pageMockState.mockGetCachedFeatureSettings;
export const mockPermanentRedirect = pageMockState.mockPermanentRedirect;
export const mockDraftMode = pageMockState.mockDraftMode;
export const mockHeaders = pageMockState.mockHeaders;
export const mockNotFound = pageMockState.mockNotFound;
export const mockGetCachedBlogPost = pageMockState.mockGetCachedBlogPost;
export const mockGetLiveBlogPost = pageMockState.mockGetLiveBlogPost;
export const mockGetMerchantSafe = pageMockState.mockGetMerchantSafe;
export const mockConnection = pageMockState.mockConnection;

vi.mock('next/headers', () => ({
  draftMode: () => pageMockState.mockDraftMode(),
  headers: () => pageMockState.mockHeaders(),
}));

vi.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => pageMockState.mockCacheLife(...args),
  cacheTag: (...args: unknown[]) => pageMockState.mockCacheTag(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => pageMockState.mockNotFound(),
  permanentRedirect: (url: string) => pageMockState.mockPermanentRedirect(url),
}));

vi.mock('next/server', () => ({
  connection: () => pageMockState.mockConnection(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: (...args: unknown[]) =>
    pageMockState.mockGetCachedBlogPost(...args),
  getCachedFeatureSettings: (...args: unknown[]) =>
    pageMockState.mockGetCachedFeatureSettings(...args),
  getMerchantSafe: (...args: unknown[]) =>
    pageMockState.mockGetMerchantSafe(...args),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: (...args: unknown[]) =>
    pageMockState.mockCreatePublicClient(...args),
}));

vi.mock('@/lib/live-blog-post', () => ({
  getLiveBlogPost: (...args: unknown[]) =>
    pageMockState.mockGetLiveBlogPost(...args),
}));

vi.mock('@/lib/blog-post-redirects', () => ({
  getBlogPostRedirect: (...args: unknown[]) =>
    pageMockState.mockGetBlogPostRedirect(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    pageMockState.mockBuildStoreUrl(merchant),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('./blog-post-content', () => ({
  buildBlogUrl: (baseUrl: string, basePath: string, postSlug?: string) =>
    postSlug
      ? `${baseUrl}${basePath}/blog/${postSlug}`
      : `${baseUrl}${basePath}/blog`,
  buildCanonicalBlogPostUrl: (
    merchant: { slug: string; custom_domain?: string },
    postSlug: string
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}/blog/${postSlug}`
      : `https://${merchant.slug}.usebaci.com/blog/${postSlug}`,
  getBlogPostTextPreview: (content: unknown) =>
    pageMockState.mockGetBlogPostTextPreview(content),
}));

vi.mock('./blog-post-page-content', () => ({
  default: (props: unknown) => pageMockState.mockBlogPostPageContent(props),
}));

vi.mock('./BlogPostPageFallback', () => ({
  BlogPostPageFallback: () => <div>Blog post page fallback</div>,
}));

export const liveBlogPost = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: null,
    custom_domain: 'ogabassey.com',
  },
  post: {
    id: 'post-1',
    title: 'The Great 5K Stall',
    slug: 'apple-studio-display-review',
    content: '<p>Test</p>',
    excerpt: 'Test excerpt',
    featured_image_url: null,
    featured_image_alt: null,
    category: 'Reviews',
    tags: ['reviews'],
    author_name: 'Bolakale',
    author_title: null,
    author_bio: null,
    published_at: '2026-03-16T10:05:33.654Z',
    updated_at: '2026-03-16T10:05:33.654Z',
    seo_title: null,
    seo_description: null,
    keywords: ['studio display'],
    reading_time_minutes: 4,
    word_count: 800,
  },
  relatedPosts: [],
  relatedProducts: [],
};

export function resetBlogPostPageMocks() {
  vi.clearAllMocks();
  const existenceQuery = {
    eq: vi.fn(),
    maybeSingle: mockBlogPostExistenceMaybeSingle,
    neq: vi.fn(),
    not: vi.fn(),
  };
  existenceQuery.eq.mockReturnValue(existenceQuery);
  existenceQuery.neq.mockReturnValue(existenceQuery);
  existenceQuery.not.mockReturnValue(existenceQuery);
  pageMockState.mockBlogPostExistenceSelect.mockReturnValue(existenceQuery);
  pageMockState.mockBlogPostExistenceFrom.mockReturnValue({
    select: pageMockState.mockBlogPostExistenceSelect,
  });
  mockCreatePublicClient.mockReturnValue({
    from: pageMockState.mockBlogPostExistenceFrom,
  });
  mockBlogPostExistenceMaybeSingle.mockResolvedValue({
    data: { id: 'post-1', slug: 'apple-studio-display-review' },
    error: null,
  });
  mockDraftMode.mockReset();
  mockDraftMode.mockResolvedValue({ isEnabled: false });
  mockGetCachedFeatureSettings.mockResolvedValue({
    blog_enabled: true,
  });
  mockGetCachedBlogPost.mockReset();
  mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);
  mockGetLiveBlogPost.mockReset();
  mockGetLiveBlogPost.mockResolvedValue(liveBlogPost);
  mockGetMerchantSafe.mockResolvedValue(liveBlogPost.merchant);
  mockHeaders.mockResolvedValue(new Headers());
  mockBlogPostPageContent.mockReset();
  mockBlogPostPageContent.mockImplementation(() => (
    <div>Blog post page content</div>
  ));
  mockBuildStoreUrl.mockImplementation(
    (merchant: { slug: string; custom_domain?: string | null }) =>
      merchant.custom_domain
        ? `https://${merchant.custom_domain}`
        : `https://${merchant.slug}.usebaci.com`
  );
  mockGetBlogPostRedirect.mockResolvedValue(null);
  mockGetBlogPostTextPreview.mockReset();
  mockGetBlogPostTextPreview.mockReturnValue('Preview text');
  mockConnection.mockReset();
}
