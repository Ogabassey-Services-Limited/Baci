import { describe, expect, it } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import { makeRequest, mockSupabase, POST } from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts Discover validation', () => {
  it('allows invalid image readiness with a warning when validation is disabled', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(
      makeRequest('/api/merchant/blog/posts', {
        body: { ...validPostData, status: 'published' },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.discoverImageReadiness).toMatchObject({
      ready: false,
      code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
    });
  });

  it('rejects external variant URLs even when validation is disabled', async () => {
    const res = await POST(
      makeRequest('/api/merchant/blog/posts', {
        body: {
          ...validPostData,
          featured_image_variants: {
            landscape_16x9: 'https://example.com/variant.webp',
          },
        },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe('BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED');
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });
});
