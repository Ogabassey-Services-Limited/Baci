import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRequestScopedBlogPost, mockHasBlogAuthorPage } = vi.hoisted(
  () => ({
    mockGetRequestScopedBlogPost: vi.fn(),
    mockHasBlogAuthorPage: vi.fn(),
  })
);

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedBlogPost: (...args: unknown[]) =>
    mockGetRequestScopedBlogPost(...args),
}));

vi.mock('@/lib/blog-authors', () => ({
  hasBlogAuthorPage: (...args: unknown[]) => mockHasBlogAuthorPage(...args),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_CONTROL_FLOW') {
      throw error;
    }
  },
}));

import { resolveBlogPostHeroShell } from './blog-post-hero-shell-data';

const publishedPost = {
  merchant: { slug: 'ogabassey' },
  post: {
    author_bio: 'Reviews editor',
    author_name: 'Bolakale John',
    author_title: 'Editor',
    category: 'Reviews',
    featured_image_alt: 'Studio display on a desk',
    featured_image_url: 'https://cdn.ogabassey.com/core-assets/blog/hero.jpg',
    published_at: '2026-03-16T10:05:33.654Z',
    reading_time_minutes: 4,
    title: 'The Great 5K Stall',
  },
};

describe('resolveBlogPostHeroShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasBlogAuthorPage.mockReturnValue(true);
  });

  it('builds domain-scoped hero + header props for a published post with a hero image', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue(publishedPost);

    const shell = await resolveBlogPostHeroShell(
      'ogabassey.com',
      'the-great-5k-stall'
    );

    expect(mockGetRequestScopedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'the-great-5k-stall',
      false
    );
    expect(shell).toEqual({
      blogHref: '/blog',
      hero: {
        alt: 'Studio display on a desk',
        src: 'https://cdn.ogabassey.com/core-assets/blog/hero.jpg',
      },
      header: {
        author_bio: 'Reviews editor',
        author_name: 'Bolakale John',
        author_title: 'Editor',
        authorHref: '/blog/author/bolakale-john',
        category: 'Reviews',
        published_at: '2026-03-16T10:05:33.654Z',
        reading_time_minutes: 4,
        title: 'The Great 5K Stall',
      },
    });
  });

  it('returns null for non-domain tenants without fetching (subdomain vs path mode is header-ambiguous in the static shell)', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue(publishedPost);

    const shell = await resolveBlogPostHeroShell(
      'my-store',
      'the-great-5k-stall'
    );

    // A '/my-store'-prefixed link is wrong for a subdomain-mode tenant, and the
    // static shell can't read headers to tell the modes apart, so the hero-hoist
    // fast path is skipped entirely (page falls back to the full-Suspense path).
    expect(shell).toBeNull();
    expect(mockGetRequestScopedBlogPost).not.toHaveBeenCalled();
  });

  it('returns null for unsafe bot slugs without fetching (unbounded cache key, #2923)', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue(publishedPost);

    const shell = await resolveBlogPostHeroShell(
      'ogabassey.com',
      `%2525${'a'.repeat(4000)}`
    );

    expect(shell).toBeNull();
    expect(mockGetRequestScopedBlogPost).not.toHaveBeenCalled();
  });

  it('omits the author href when the author has no hub page', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue(publishedPost);
    mockHasBlogAuthorPage.mockReturnValue(false);

    const shell = await resolveBlogPostHeroShell('ogabassey.com', 'slug');

    expect(shell?.header.authorHref).toBeUndefined();
  });

  it('returns null for a published post without a featured image', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue({
      ...publishedPost,
      post: { ...publishedPost.post, featured_image_url: null },
    });

    expect(await resolveBlogPostHeroShell('ogabassey.com', 'slug')).toBeNull();
  });

  it('returns null when the cached lookup finds no post', async () => {
    mockGetRequestScopedBlogPost.mockResolvedValue(null);

    expect(await resolveBlogPostHeroShell('ogabassey.com', 'slug')).toBeNull();
  });

  it('swallows non-control-flow lookup errors and returns null', async () => {
    mockGetRequestScopedBlogPost.mockRejectedValue(new Error('cache miss'));

    expect(await resolveBlogPostHeroShell('ogabassey.com', 'slug')).toBeNull();
  });

  it('rethrows framework control-flow errors', async () => {
    mockGetRequestScopedBlogPost.mockRejectedValue(
      new Error('NEXT_CONTROL_FLOW')
    );

    await expect(
      resolveBlogPostHeroShell('ogabassey.com', 'slug')
    ).rejects.toThrow('NEXT_CONTROL_FLOW');
  });
});
