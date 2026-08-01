import { describe, expect, it } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import {
  MERCHANT_ID,
  makeRequest,
  mockSupabase,
  POST,
} from './route.test-support';

const PRODUCT_ID = 'd5bc84b7-35c2-4e09-a5e7-6ebdd0fd1145';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts embedded products', () => {
  it('atomically creates a post with merchant-owned embedded products', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: 'new-post-id',
          merchant_id: MERCHANT_ID,
          title: validPostData.title,
          slug: validPostData.slug,
          content: validPostData.content,
          excerpt: null,
          category: null,
          featured_image_url: null,
          status: 'draft',
          published_at: null,
        },
      ],
      error: null,
    });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', {
        body: { ...validPostData, embedded_products: [PRODUCT_ID] },
      })
    );

    expect(response.status).toBe(201);
    expect(mockSupabase.insert).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'mutate_merchant_blog_post_with_product_links',
      expect.objectContaining({
        p_merchant_id: MERCHANT_ID,
        p_post_id: null,
        p_product_ids: [PRODUCT_ID],
      })
    );
  });

  it('rejects a product ID that is not owned by the selected merchant', async () => {
    mockSupabase.in.mockResolvedValue({ data: [], error: null });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', {
        body: { ...validPostData, embedded_products: [PRODUCT_ID] },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'One or more embedded products do not belong to this merchant',
    });
    expect(mockSupabase.insert).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when embedded-product ownership cannot be checked', async () => {
    mockSupabase.in.mockResolvedValue({
      data: null,
      error: { message: 'products unavailable' },
    });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', {
        body: { ...validPostData, embedded_products: [PRODUCT_ID] },
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to validate embedded products',
    });
    expect(mockSupabase.insert).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
