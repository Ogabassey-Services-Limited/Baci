import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCachedBlogListing = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing,
}));

describe('GET /blog/index.html.md', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns blog index markdown', async () => {
    getCachedBlogListing.mockResolvedValue({
      merchant: { business_name: 'Ogabassey', slug: 'ogabassey' },
      posts: [
        {
          title: 'Guide',
          slug: 'guide',
          excerpt: 'Read this',
          reading_time_minutes: 4,
        },
      ],
      categories: ['Guides'],
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/blog/index.html.md'),
      {
        params: Promise.resolve({ slug: 'ogabassey.com' }),
      }
    );
    const body = await response.text();

    expect(body).toContain('# Ogabassey Blog');
    expect(body).toContain('/blog/guide.md');
  });
});
