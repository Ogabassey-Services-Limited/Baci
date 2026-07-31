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

  it('does not treat a partial linked-product response as a successful hydration', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...embeddedProductPost,
          embedded_products: ['product-a', 'product-b'],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          products: [
            {
              id: 'product-a',
              name: 'Product A',
              price: 100,
              images: [],
              slug: 'product-a',
              status: 'active',
            },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadBlogPost('post-1', 'merchant-b');

    expect(result).toMatchObject({
      status: 'success',
      embeddedProducts: null,
      productsLoadFailed: true,
    });
  });

  it('does not accept unrelated products alongside every requested product', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...embeddedProductPost,
          embedded_products: ['product-a', 'product-b'],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          products: ['product-a', 'product-b', 'product-c'].map((id) => ({
            id,
            name: `Product ${id}`,
            price: 100,
            images: [],
            slug: id,
            status: 'active',
          })),
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadBlogPost('post-1', 'merchant-b');

    expect(result).toMatchObject({
      status: 'success',
      embeddedProducts: null,
      productsLoadFailed: true,
    });
  });

  it.each([
    ['returns an error status', false, { products: [] }],
    ['returns malformed data', true, { products: 'not-an-array' }],
  ])('fails closed when the linked-product endpoint %s', async (_, ok, body) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(embeddedProductPost))
      .mockResolvedValueOnce({ ok, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadBlogPost('post-1', 'merchant-b');

    expect(result).toMatchObject({
      status: 'success',
      embeddedProducts: null,
      productsLoadFailed: true,
    });
  });
});
