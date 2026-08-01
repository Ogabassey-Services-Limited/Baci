import { describe, expect, it, vi } from 'vitest';
import { createBlogPost } from './new-blog-post-requests';
import type { NewBlogPostFormData } from './new-blog-post-types';

const { fetchWithCsrf } = vi.hoisted(() => ({ fetchWithCsrf: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf }));

const formData: NewBlogPostFormData = {
  author_bio: '',
  author_name: 'Baci',
  author_title: '',
  category: '',
  content: '<p>Post</p>',
  excerpt: '',
  featured_image_alt: '',
  featured_image_height: null,
  featured_image_url: '',
  featured_image_variants: {},
  featured_image_width: null,
  seo_description: '',
  seo_title: '',
  slug: '',
  tags: ' news,  launch ,,',
  title: ' Launch ',
};

describe('createBlogPost', () => {
  it('does not send a post before the merchant context has resolved', async () => {
    await expect(
      createBlogPost({
        embeddedProducts: [],
        formData,
        merchantId: undefined,
        status: 'draft',
      })
    ).rejects.toThrow('Merchant context is still loading');
    expect(fetchWithCsrf).not.toHaveBeenCalled();
  });

  it('sends the selected merchant id and normalized tag list', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({ id: 'post-1', slug: 'launch' }),
      ok: true,
    });

    await expect(
      createBlogPost({
        embeddedProducts: [],
        formData,
        merchantId: 'merchant/1',
        status: 'published',
      })
    ).resolves.toEqual({ id: 'post-1', slug: 'launch' });

    expect(fetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/posts?merchantId=merchant%2F1',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(fetchWithCsrf.mock.calls[0]?.[1].body as string);
    expect(body.tags).toEqual(['news', 'launch']);
    expect(body.status).toBe('published');
  });
});
