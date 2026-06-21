import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// All `vi.mock` factories below reference these mocks. Because `vi.mock` calls
// are hoisted above ordinary `const` declarations, we initialize every mock
// via `vi.hoisted` so the factories can safely resolve the identifiers at
// hoist time (rather than relying on the factory body being called lazily).
const {
  mockBlogPostBodyFallback,
  mockDraftMode,
  mockHeaders,
  mockNotFound,
  mockGetCachedBlogPost,
  mockGetLiveBlogPost,
  mockGetBlogPostRedirect,
  mockBuildInformationalClusterModel,
  mockGenerateBlogPostSchema,
  mockNextImage,
  mockBlogPostHeader,
  mockBlogPostBody,
} = vi.hoisted(() => ({
  mockBlogPostBodyFallback: vi.fn((_props: unknown) => null as ReactNode),
  mockDraftMode: vi.fn(),
  mockHeaders: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockGetCachedBlogPost: vi.fn(),
  mockGetLiveBlogPost: vi.fn(),
  mockGetBlogPostRedirect: vi.fn(),
  mockBuildInformationalClusterModel: vi.fn(),
  mockGenerateBlogPostSchema: vi.fn<(data: unknown) => Record<string, unknown>>(
    () => ({})
  ),
  mockNextImage: vi.fn((_props: Record<string, unknown>) => null),
  mockBlogPostHeader: vi.fn(({ title }: { title: string; locale?: string }) => (
    <h1>{title}</h1>
  )),
  mockBlogPostBody: vi.fn((_props?: unknown) => null),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
}));

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  headers: () => mockHeaders(),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => mockNextImage(props),
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
  },
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

vi.mock('@/lib/blog-post-redirects', () => ({
  getBlogPostRedirect: (...args: unknown[]) => mockGetBlogPostRedirect(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBlogPostSchema: (data: unknown) => mockGenerateBlogPostSchema(data),
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
    social_media: {
      instagram: '@ogabassey',
      tiktok: 'https://www.tiktok.com/@ogabassey',
      pinterest: '@ignored-platform',
    },
  },
  post: {
    id: 'post-1',
    title: 'Best Phones in Nigeria for 2026',
    slug: 'best-phones-in-nigeria',
    content: '<p>Test</p>',
    excerpt: 'Affordable Android and iPhone picks for buyers in Nigeria.',
    featured_image_url: null,
    featured_image_alt: null,
    featured_image_variants: {},
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
  relatedProducts: [],
};

describe('BlogPostPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlogPostBody.mockReset();
    mockBlogPostBodyFallback.mockReset();
    mockNextImage.mockReset();
    mockGenerateBlogPostSchema.mockReset();
    mockBlogPostBody.mockImplementation(() => null);
    mockBlogPostBodyFallback.mockImplementation(() => null);
    mockGenerateBlogPostSchema.mockReturnValue({});
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue(
      new Headers({
        'accept-language': 'en-us,en;q=0.8',
      })
    );
    mockGetCachedBlogPost.mockResolvedValue(smartphoneGuideBlogPost);
    mockGetLiveBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockResolvedValue(null);
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
    expect(mockBlogPostBody).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedProducts: [],
      })
    );
  });

  it('passes related products through to the blog post body', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      ...smartphoneGuideBlogPost,
      relatedProducts: [
        {
          id: 'product-1',
          name: 'iPhone 16',
          slug: 'iphone-16',
          category_slug: 'smartphones',
        },
      ],
    });

    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockBlogPostBody).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedProducts: [
          expect.objectContaining({
            name: 'iPhone 16',
            slug: 'iphone-16',
          }),
        ],
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

  it('passes persisted Discover image variants to structured data', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      ...smartphoneGuideBlogPost,
      post: {
        ...smartphoneGuideBlogPost.post,
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: {
          square_1x1:
            'https://cdn.ogabassey.com/media/merchant-1/blog/post/square_1x1.webp',
          landscape_16x9:
            'https://cdn.ogabassey.com/media/merchant-1/blog/post/landscape_16x9.webp',
          standard_4x3:
            'https://cdn.ogabassey.com/media/merchant-1/blog/post/standard_4x3.webp',
        },
      },
    });

    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockGenerateBlogPostSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: [
          'https://cdn.ogabassey.com/media/merchant-1/blog/post/landscape_16x9.webp',
          'https://cdn.ogabassey.com/media/merchant-1/blog/post/standard_4x3.webp',
          'https://cdn.ogabassey.com/media/merchant-1/blog/post/square_1x1.webp',
        ],
      })
    );
  });

  it('normalizes publisher social handles before passing blog structured data', async () => {
    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockGenerateBlogPostSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        publisher: expect.objectContaining({
          sameAs: [
            'https://instagram.com/ogabassey',
            'https://www.tiktok.com/@ogabassey',
          ],
        }),
      })
    );
  });

  it('ignores non-string publisher social JSON values before structured data', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      ...smartphoneGuideBlogPost,
      merchant: {
        ...smartphoneGuideBlogPost.merchant,
        social_media: {
          instagram: null,
          tiktok: 'https://www.tiktok.com/@ogabassey',
          youtube: 123,
        },
      },
    });

    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockGenerateBlogPostSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        publisher: expect.objectContaining({
          sameAs: ['https://www.tiktok.com/@ogabassey'],
        }),
      })
    );
  });

  it('does not emit generic fallback image markup for imageless posts', async () => {
    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockGenerateBlogPostSchema).toHaveBeenCalledWith(
      expect.not.objectContaining({
        image: expect.stringContaining('opengraph-image'),
      })
    );
    expect(mockGenerateBlogPostSchema).toHaveBeenCalledWith(
      expect.not.objectContaining({
        imageUrls: expect.any(Array),
      })
    );
  });

  it('preloads the featured article image without deprecated priority', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      ...smartphoneGuideBlogPost,
      post: {
        ...smartphoneGuideBlogPost.post,
        featured_image_url:
          'https://cdn.ogabassey.com/media/blog/best-phones-cover.webp',
        featured_image_alt: 'Best phones in Nigeria cover',
      },
    });

    render(
      await BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          postSlug: 'best-phones-in-nigeria',
        }),
      })
    );

    expect(mockNextImage).toHaveBeenCalled();

    const imageProps = mockNextImage.mock.calls[0]?.[0];

    expect(imageProps).toEqual(
      expect.objectContaining({
        src: 'https://cdn.ogabassey.com/media/blog/best-phones-cover.webp',
        fetchPriority: 'high',
        loading: 'eager',
        preload: true,
      })
    );
    expect(imageProps).not.toHaveProperty('priority');
  });

  it('permanently redirects retired direct blog slugs before rendering notFound', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockResolvedValueOnce({
      merchant: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      targetSlug: 'canonical-post',
    });

    await expect(
      BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          postSlug: 'retired-post',
        }),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/canonical-post'
    );

    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'retired-post'
    );
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it('renders notFound for missing direct blog slugs without redirects', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockResolvedValueOnce(null);

    await expect(
      BlogPostPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          postSlug: 'retired-post',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'retired-post'
    );
    expect(mockNotFound).toHaveBeenCalled();
  });
});
