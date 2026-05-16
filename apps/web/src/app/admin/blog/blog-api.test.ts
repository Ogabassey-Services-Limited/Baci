import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import { createPlatformBlogPost, updatePlatformBlogPost } from './blog-api';
import type { PlatformAdminBlogFormState } from './blog-types';

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);

const formState: PlatformAdminBlogFormState = {
  author_name: 'Baci Editorial',
  category: 'Commerce',
  content: '<p>How to sell online</p>',
  excerpt: 'A practical guide',
  featured_image_alt: 'Phone shop counter',
  featured_image_height: 675,
  featured_image_url:
    'https://cdn.ogabassey.com/blog/platform/original-image.webp',
  featured_image_variants: {
    landscape_16x9:
      'https://cdn.ogabassey.com/blog/platform/image/landscape_16x9.webp',
    square_1x1: 'https://cdn.ogabassey.com/blog/platform/image/square_1x1.webp',
  },
  featured_image_width: 1200,
  seo_description: 'SEO description',
  seo_title: 'SEO title',
  slug: 'sell-online',
  status: 'published',
  tags: 'merchant, ecommerce',
  title: 'Sell online',
};

function mockJsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: true,
  } as unknown as Response;
}

describe('platform blog API client', () => {
  beforeEach(() => {
    mockFetchWithCsrf.mockReset();
    mockFetchWithCsrf.mockResolvedValue(mockJsonResponse({ id: 'post-1' }));
  });

  it('includes featured image metadata when creating a post', async () => {
    await createPlatformBlogPost(formState);

    expect(mockFetchWithCsrf).toHaveBeenCalledWith('/api/admin/blog/posts', {
      body: JSON.stringify({
        author_name: 'Baci Editorial',
        category: 'Commerce',
        content: '<p>How to sell online</p>',
        excerpt: 'A practical guide',
        featured_image_alt: 'Phone shop counter',
        featured_image_height: 675,
        featured_image_url:
          'https://cdn.ogabassey.com/blog/platform/original-image.webp',
        featured_image_variants: formState.featured_image_variants,
        featured_image_width: 1200,
        seo_description: 'SEO description',
        seo_title: 'SEO title',
        slug: 'sell-online',
        status: 'published',
        tags: 'merchant, ecommerce',
        title: 'Sell online',
      }),
      method: 'POST',
    });
  });

  it('includes featured image metadata when updating a post', async () => {
    await updatePlatformBlogPost('post-1', formState);

    const [, init] = mockFetchWithCsrf.mock.calls[0] ?? [];
    expect(init).toEqual(
      expect.objectContaining({
        body: expect.stringContaining('"featured_image_width":1200'),
        method: 'PATCH',
      })
    );
  });
});
