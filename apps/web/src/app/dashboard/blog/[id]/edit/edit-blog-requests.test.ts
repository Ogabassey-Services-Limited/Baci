import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBlogPost } from './edit-blog-requests';

const embeddedProductPost = {
  id: 'post-1',
  title: 'Merchant B post',
  slug: 'merchant-b-post',
  content: '',
  excerpt: '',
  featured_image_url: '',
  featured_image_alt: '',
  featured_image_width: null,
  featured_image_height: null,
  featured_image_variants: {},
  category: '',
  tags: [],
  keywords: [],
  author_name: '',
  author_title: '',
  author_bio: '',
  seo_title: '',
  seo_description: '',
  focus_keyword: '',
  status: 'draft',
  published_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  view_count: 0,
  word_count: 0,
  reading_time_minutes: 0,
  embedded_products: ['product-b'],
};

describe('loadBlogPost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads embedded products from the selected merchant rather than implicit context', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(embeddedProductPost))
      .mockResolvedValueOnce(Response.json({ products: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await loadBlogPost('post-1', 'merchant-b');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/products?ids=product-b&merchantId=merchant-b'
    );
  });
});
