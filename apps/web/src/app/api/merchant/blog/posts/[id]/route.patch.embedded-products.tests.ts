import { describe, expect, it } from 'vitest';
import { existingPost, registerPatchTestSetup } from './patch.test-support';
import {
  MERCHANT_ID,
  makeParams,
  makeRequest,
  mockSupabase,
  PATCH,
  POST_ID,
} from './route.test-support';

const PRODUCT_ID = 'd5bc84b7-35c2-4e09-a5e7-6ebdd0fd1145';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id] embedded products', () => {
  it('atomically replaces product links with merchant-owned IDs', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          ...existingPost,
          content: '<p>Updated content</p>',
          title: 'Updated Title',
        },
      ],
      error: null,
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        content: '<p>Updated content</p>',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'mutate_merchant_blog_post_with_product_links',
      expect.objectContaining({
        p_merchant_id: MERCHANT_ID,
        p_post_id: POST_ID,
        p_product_ids: [PRODUCT_ID],
      })
    );
  });

  it('does not replace existing links when the payload omits embedded_products', async () => {
    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects foreign embedded product IDs before updating the post', async () => {
    mockSupabase.in.mockResolvedValue({ data: [], error: null });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'One or more embedded products do not belong to this merchant',
    });
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
