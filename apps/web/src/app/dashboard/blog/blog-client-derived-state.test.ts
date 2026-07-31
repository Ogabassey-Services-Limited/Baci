import { describe, expect, it, vi } from 'vitest';

const classifyBlogDiscoverImageReadiness = vi.hoisted(() => vi.fn());

vi.mock('@/lib/blog-discover-readiness', () => ({
  classifyBlogDiscoverImageReadiness,
}));

import { blogClientDerivedState } from './blog-client-derived-state';
import type { BlogPost } from './blog-client-types';

const posts: BlogPost[] = [
  {
    author_name: 'Ada',
    category: null,
    created_at: '2026-01-01T00:00:00Z',
    excerpt: null,
    featured_image_height: null,
    featured_image_url: null,
    featured_image_variants: null,
    featured_image_width: null,
    id: 'published',
    published_at: '2026-01-02T00:00:00Z',
    reading_time_minutes: null,
    slug: 'published',
    status: 'published',
    title: 'Published',
    updated_at: '2026-01-02T00:00:00Z',
    view_count: 14,
  },
  {
    author_name: 'Ada',
    category: null,
    created_at: '2026-01-01T00:00:00Z',
    excerpt: null,
    featured_image_height: null,
    featured_image_url: null,
    featured_image_variants: null,
    featured_image_width: null,
    id: 'draft',
    published_at: null,
    reading_time_minutes: null,
    slug: 'draft',
    status: 'draft',
    title: 'Draft',
    updated_at: '2026-01-02T00:00:00Z',
    view_count: 3,
  },
];

describe('blogClientDerivedState', () => {
  it('uses server counts when available and calculates total views locally', () => {
    expect(
      blogClientDerivedState.getStats(posts, {
        archived: 2,
        draft: 5,
        published: 7,
        total: 14,
      })
    ).toEqual({ drafts: 5, pageViews: 17, published: 7, total: 14 });
  });

  it('evaluates Discover readiness only for published posts', () => {
    classifyBlogDiscoverImageReadiness.mockReturnValue(
      'missing_landscape_variant'
    );

    const readiness = blogClientDerivedState.getDiscoverReadiness(
      posts,
      'merchant-1'
    );

    expect(classifyBlogDiscoverImageReadiness).toHaveBeenCalledTimes(1);
    expect(readiness.remediationCount).toBe(1);
    expect(readiness.byPostId.get('published')).toBe(
      'missing_landscape_variant'
    );
    expect(readiness.byPostId.has('draft')).toBe(false);
  });
});
