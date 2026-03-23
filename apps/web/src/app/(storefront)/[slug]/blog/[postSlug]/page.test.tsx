import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDraftMode = vi.fn();
const mockHeaders = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetCachedBlogPost = vi.fn();
const mockGetLiveBlogPost = vi.fn();

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

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

vi.mock('./BlogPostBody', () => ({
  BlogPostBody: () => null,
}));

vi.mock('./BlogPostBodyFallback', () => ({
  BlogPostBodyFallback: () => null,
}));

vi.mock('./BlogPostHeader', () => ({
  BlogPostHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('./blog-post-content', () => ({
  buildBlogUrl: (baseUrl: string, basePath: string, postSlug?: string) =>
    postSlug
      ? `${baseUrl}${basePath}/blog/${postSlug}`
      : `${baseUrl}${basePath}/blog`,
  getBlogPostTextPreview: () => 'Preview text',
}));

vi.mock('./view-counter', () => ({
  ViewCounter: () => null,
}));

import BlogPostPage, { generateMetadata } from './page';

const liveBlogPost = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: null,
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
};

describe('storefront blog post page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to a live blog query for metadata when the cached lookup misses', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue({
      get: (key: string) => (key === 'host' ? 'ogabassey.com' : null),
    });
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(liveBlogPost);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(mockGetLiveBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review'
    );
  });

  it('uses the cached blog query when metadata is already available', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue({
      get: (key: string) => (key === 'host' ? 'ogabassey.com' : null),
    });
    mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);
    mockGetLiveBlogPost.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
  });

  it('renders the page when the live fallback finds the post', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue({
      get: (key: string) => {
        if (key === 'host') return 'ogabassey.com';
        if (key === 'accept-language') return 'en-NG';
        return null;
      },
    });
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(liveBlogPost);

    const result = await BlogPostPage({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });
    const view = render(result as ReactElement);

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(
      view.getByRole('heading', { name: 'The Great 5K Stall' })
    ).toBeTruthy();
  });

  it('still throws notFound when both cached and live lookups miss', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockHeaders.mockResolvedValue({
      get: () => null,
    });
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(null);

    await expect(
      BlogPostPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          postSlug: 'missing-post',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
