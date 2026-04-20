import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBlogPostBody, mockBlogPostBodyFallback } = vi.hoisted(() => ({
  mockBlogPostBody: vi.fn((_props: unknown) => null),
  mockBlogPostBodyFallback: vi.fn((_props: unknown) => null as ReactNode),
}));

const mockDraftMode = vi.fn();
const mockHeaders = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetCachedBlogPost = vi.fn();
const mockGetLiveBlogPost = vi.fn();
const mockBuildInformationalClusterModel = vi.fn();
const mockBlogPostHeader = vi.fn(
  ({ title }: { title: string; locale?: string }) => <h1>{title}</h1>
);

vi.mock('lucide-react', () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
}));

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  headers: () => mockHeaders(),
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock(
  '@/components/storefront/ogabassey/seo/informational-cluster-panel',
  () => ({
    InformationalClusterPanel: ({
      model,
    }: {
      model: {
        primaryCategoryLink?: { href: string; label: string } | null;
        commerceLinks?: Array<{ href: string; label: string }>;
      } | null;
    }) =>
      model ? (
        <div>
          {model.primaryCategoryLink ? (
            <a href={model.primaryCategoryLink.href}>
              {model.primaryCategoryLink.label}
            </a>
          ) : null}
          {model.commerceLinks?.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      ) : null,
  })
);

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: (...args: unknown[]) => mockGetCachedBlogPost(...args),
}));

vi.mock('@/lib/live-blog-post', () => ({
  getLiveBlogPost: (...args: unknown[]) => mockGetLiveBlogPost(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBlogPostSchema: () => ({}),
  generateBreadcrumbSchema: () => ({}),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/storefront-content/build-informational-cluster-model', () => ({
  buildInformationalClusterModel: (...args: unknown[]) =>
    mockBuildInformationalClusterModel(...args),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

vi.mock('./BlogPostBody', () => ({
  BlogPostBody: (props: unknown) => mockBlogPostBody(props),
}));

vi.mock('./BlogPostBodyFallback', () => ({
  BlogPostBodyFallback: (props: unknown) => mockBlogPostBodyFallback(props),
}));

vi.mock('./BlogPostHeader', () => ({
  BlogPostHeader: (props: {
    title: string;
    locale?: string;
    author_bio: string | null;
    author_name: string;
    author_title: string | null;
    category: string | null;
    published_at: string | null;
    reading_time_minutes: number | null;
  }) => mockBlogPostHeader(props),
}));

vi.mock('./blog-post-content', () => ({
  buildCanonicalBlogPostUrl: (
    merchant: { slug: string; custom_domain?: string },
    postSlug: string
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}/blog/${postSlug}`
      : `https://${merchant.slug}.usebaci.com/blog/${postSlug}`,
  getBlogPostTextPreview: () => 'Preview text',
}));

vi.mock('./view-counter', () => ({
  ViewCounter: () => null,
}));

import BlogPostPageContent from './blog-post-page-content';

const smartphoneGuideBlogPost = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: null,
    custom_domain: 'ogabassey.com',
  },
  post: {
    id: 'post-1',
    title: 'Best Phones in Nigeria for 2026',
    slug: 'best-phones-in-nigeria',
    content: '<p>Test</p>',
    excerpt: 'Affordable Android and iPhone picks for buyers in Nigeria.',
    featured_image_url: null,
    featured_image_alt: null,
    category: 'Smartphones',
    tags: ['budget', 'iphone', 'samsung'],
    author_name: 'Bolakale',
    author_title: null,
    author_bio: null,
    published_at: '2026-03-16T10:05:33.654Z',
    updated_at: '2026-03-16T10:05:33.654Z',
    seo_title: null,
    seo_description: null,
    keywords: ['android', 'battery', 'smartphones'],
    reading_time_minutes: 4,
    word_count: 800,
  },
  relatedPosts: [],
};

describe('BlogPostPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlogPostBody.mockReset();
    mockBlogPostBodyFallback.mockReset();
    mockBlogPostBody.mockImplementation(() => null);
    mockBlogPostBodyFallback.mockImplementation(() => null);
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue(
      new Headers({
        'accept-language': 'en-us,en;q=0.8',
      })
    );
    mockGetCachedBlogPost.mockResolvedValue(smartphoneGuideBlogPost);
    mockBuildInformationalClusterModel.mockResolvedValue({
      heading: 'Continue shopping smartphones',
      primaryCategoryLink: {
        href: 'https://ogabassey.com/smartphones',
        label: 'Shop more smartphones',
      },
      commerceLinks: [
        {
          href: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
          label: 'Apple vs Samsung',
        },
      ],
      featuredProducts: [],
    });
  });

  it('renders crawlable commerce links and passes the canonicalized locale', async () => {
    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(
      screen.getByRole('link', { name: /shop more smartphones/i })
    ).toHaveAttribute('href', 'https://ogabassey.com/smartphones');
    expect(
      screen.getByRole('link', { name: 'Apple vs Samsung' })
    ).toHaveAttribute(
      'href',
      'https://ogabassey.com/smartphones/compare/apple-vs-samsung'
    );
    expect(mockBlogPostHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en-US',
        title: 'Best Phones in Nigeria for 2026',
      })
    );
  });

  it('keeps the article chrome visible while the blog body fallback streams', async () => {
    mockBlogPostBody.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the blog body suspended so the nested fallback streams.
      });
    });
    mockBlogPostBodyFallback.mockImplementation(() => (
      <div>Blog body loading</div>
    ));

    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Best Phones in Nigeria for 2026',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Blog body loading')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /shop more smartphones/i })
    ).toBeInTheDocument();
  });
});
