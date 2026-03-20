import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCachedBlogPost = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost,
}));

describe('GET /blog/[postSlug].md', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns blog post markdown', async () => {
    getCachedBlogPost.mockResolvedValue({
      merchant: { business_name: 'Ogabassey' },
      post: {
        title: 'Guide',
        slug: 'guide',
        excerpt: 'Read this',
        author_name: 'Editor',
      },
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/blog/guide.md'),
      {
        params: Promise.resolve({ slug: 'ogabassey.com', postSlug: 'guide' }),
      }
    );
    const body = await response.text();

    expect(body).toContain('# Guide');
    expect(body).toContain('/blog/guide.md');
  });
});
