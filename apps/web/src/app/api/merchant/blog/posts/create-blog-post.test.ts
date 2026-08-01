import { describe, expect, it } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import {
  makeRequest,
  mockAuthenticateApiRequest,
  mockSupabase,
} from './route.test-support';

const { createBlogPost } = await import('./create-blog-post');

registerPostTestSetup();

describe('createBlogPost', () => {
  it('stops an unauthenticated mutation before it can create a merchant post', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await createBlogPost(
      makeRequest('/api/merchant/blog/posts', { body: validPostData })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('creates an authenticated merchant draft through the atomic post mutation', async () => {
    const response = await createBlogPost(
      makeRequest('/api/merchant/blog/posts', { body: validPostData })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: '1',
      merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      slug: 'new-blog-post',
    });
    expect(mockSupabase.rpc).toHaveBeenCalledOnce();
  });
});
