import { vi } from 'vitest';

const pageMockState = vi.hoisted(() => ({
  mockBlogPostPageContent: vi.fn((_props: unknown) => (
    <div>Blog post page content</div>
  )),
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
  mockPermanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
  }),
  mockDraftMode: vi.fn(),
  mockHeaders: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockGetRequestScopedBlogPost: vi.fn(),
  // Regression guard: the page module must never touch next/server's
  // connection() again — that is exactly what forced the route dynamic and
  // logged NEXT_STATIC_GEN_BAILOUT on every production request (PR #2882).
  mockConnection: vi.fn(),
  mockResolveBlogPostHeroShell: vi.fn(),
  mockPreloadBlogPostHero: vi.fn(),
  mockResolveBlogPostStaticParams: vi.fn(),
  mockBlogPostShell: vi.fn((props: unknown) => {
    const { hero, header, children } = props as {
      hero?: { src?: string } | null;
      header?: { title?: string };
      children?: unknown;
    };
    return (
      <div>
        <span>Blog post shell</span>
        <span data-testid="shell-hero">{hero?.src}</span>
        <span data-testid="shell-title">{header?.title}</span>
        {children as never}
      </div>
    );
  }),
}));

export const mockBlogPostPageContent = pageMockState.mockBlogPostPageContent;
export const mockBuildStoreUrl = pageMockState.mockBuildStoreUrl;
export const mockGetBlogPostRedirect = pageMockState.mockGetBlogPostRedirect;
export const mockGetBlogPostTextPreview =
  pageMockState.mockGetBlogPostTextPreview;
export const mockPermanentRedirect = pageMockState.mockPermanentRedirect;
export const mockDraftMode = pageMockState.mockDraftMode;
export const mockHeaders = pageMockState.mockHeaders;
export const mockNotFound = pageMockState.mockNotFound;
export const mockGetRequestScopedBlogPost =
  pageMockState.mockGetRequestScopedBlogPost;
export const mockConnection = pageMockState.mockConnection;
export const mockResolveBlogPostHeroShell =
  pageMockState.mockResolveBlogPostHeroShell;
export const mockPreloadBlogPostHero = pageMockState.mockPreloadBlogPostHero;
export const mockResolveBlogPostStaticParams =
  pageMockState.mockResolveBlogPostStaticParams;
export const mockBlogPostShell = pageMockState.mockBlogPostShell;

vi.mock('next/headers', () => ({
  draftMode: () => pageMockState.mockDraftMode(),
  headers: () => pageMockState.mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => pageMockState.mockNotFound(),
  permanentRedirect: (url: string) => pageMockState.mockPermanentRedirect(url),
  unstable_rethrow: (error: unknown) => {
    // Mirror Next's behavior for the control-flow errors these mocks emit.
    if (
      error instanceof Error &&
      (error.message === 'NEXT_NOT_FOUND' ||
        error.message.startsWith('NEXT_PERMANENT_REDIRECT'))
    ) {
      throw error;
    }
  },
}));

vi.mock('next/server', () => ({
  connection: () => pageMockState.mockConnection(),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedBlogPost: (...args: unknown[]) =>
    pageMockState.mockGetRequestScopedBlogPost(...args),
}));

vi.mock('@/lib/blog-post-redirects', () => ({
  getBlogPostRedirect: (...args: unknown[]) =>
    pageMockState.mockGetBlogPostRedirect(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    pageMockState.mockBuildStoreUrl(merchant),
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

vi.mock('./BlogPostBodyFallback', () => ({
  BlogPostBodyFallback: () => <div>Blog post body fallback</div>,
}));

vi.mock('./blog-post-hero-shell-data', () => ({
  resolveBlogPostHeroShell: (...args: unknown[]) =>
    pageMockState.mockResolveBlogPostHeroShell(...args),
}));

vi.mock('./blog-post-hero-resource-hints', () => ({
  preloadOgabasseyBlogPostHeroResources: (...args: unknown[]) =>
    pageMockState.mockPreloadBlogPostHero(...args),
}));

vi.mock('./blog-post-static-params', () => ({
  resolveBlogPostStaticParams: (...args: unknown[]) =>
    pageMockState.mockResolveBlogPostStaticParams(...args),
}));

vi.mock('./blog-post-shell', () => ({
  BlogPostShell: (props: unknown) => pageMockState.mockBlogPostShell(props),
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
  mockDraftMode.mockReset();
  mockDraftMode.mockResolvedValue({ isEnabled: false });
  mockGetRequestScopedBlogPost.mockReset();
  mockGetRequestScopedBlogPost.mockResolvedValue(liveBlogPost);
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
  // Default: no cached hero → the page root takes the full-Suspense fallback
  // path (the pre-hoist behavior the bulk of these tests assert).
  mockResolveBlogPostHeroShell.mockReset();
  mockResolveBlogPostHeroShell.mockResolvedValue(null);
  mockPreloadBlogPostHero.mockReset();
  mockResolveBlogPostStaticParams.mockReset();
  mockResolveBlogPostStaticParams.mockResolvedValue([]);
  mockBlogPostShell.mockClear();
}
