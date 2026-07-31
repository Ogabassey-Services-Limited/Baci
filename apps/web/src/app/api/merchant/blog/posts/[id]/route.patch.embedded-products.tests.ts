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
    mockSupabase.rpc.mockResolvedValue({
      data: [{ ...existingPost, title: 'Updated Title' }],
      error: null,
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'mutate_merchant_blog_post_with_product_links',
      expect.objectContaining({
        p_merchant_id: MERCHANT_ID,
        p_post_id: POST_ID,
        p_product_ids: null,
      })
    );
  });

  it('returns post not found when an omitted-link update loses a concurrent deletion', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'blog_post_not_found' },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Post not found' });
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'mutate_merchant_blog_post_with_product_links',
      expect.objectContaining({ p_product_ids: null })
    );
  });

  it('returns forbidden when an omitted-link update loses marketing edit permission', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'merchant_marketing_edit_permission_required',
      },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Permission denied' });
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

  it('returns post not found when the atomic update loses a concurrently deleted post', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'blog_post_not_found' },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Post not found' });
  });

  it('returns forbidden when the atomic update loses marketing edit permission', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'merchant_marketing_edit_permission_required',
      },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Permission denied' });
  });

  it('returns a conflict when the atomic update races a duplicate slug', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        details: 'Key (merchant_id, slug)=(updated-title) already exists.',
        message:
          'duplicate key value violates unique constraint "blog_posts_merchant_id_slug_key"',
      },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'A post with this slug already exists',
    });
  });

  it('does not mislabel an unrelated unique violation as a slug conflict', async () => {
    mockSupabase.in.mockResolvedValue({
      data: [{ id: PRODUCT_ID }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        details:
          'Key (merchant_id, product_id)=(merchant, product) already exists.',
        message:
          'duplicate key value violates unique constraint "blog_post_products_merchant_id_product_id_key"',
      },
    });

    const response = await PATCH(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
        title: 'Updated Title',
        embedded_products: [PRODUCT_ID],
      }),
      makeParams(POST_ID)
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to persist post' });
  });
});
