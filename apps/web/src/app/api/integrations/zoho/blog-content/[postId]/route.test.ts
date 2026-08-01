import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockQuery = {
  eq: vi.fn(() => mockQuery),
  from: vi.fn(() => mockQuery),
  maybeSingle: mockMaybeSingle,
  not: vi.fn(() => mockQuery),
  select: vi.fn(() => mockQuery),
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockQuery),
}));

vi.mock('@/lib/zoho-blog-content-config-server', () => ({
  getConfiguredZohoBlogContentConfig: () => ({
    contentSecret: 'content-secret',
    publicBaseUrl: 'https://usebaci.com',
  }),
}));

vi.mock('@/lib/zoho-blog-campaign-server', () => {
  throw new Error(
    'Zoho blog-content route must not load the campaign-dispatch capability graph'
  );
});

vi.mock('@/lib/zoho-blog-campaign-dispatch', () => {
  throw new Error(
    'Zoho blog-content route must not load the campaign-dispatch module'
  );
});

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: vi.fn(async () => ({
    canonicalMerchantSlug: 'ogabassey',
    identifiers: ['ogabassey'],
  })),
}));

vi.mock('@/lib/merchant-zoho-campaign-settings', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/merchant-zoho-campaign-settings')
  >('@/lib/merchant-zoho-campaign-settings');

  return {
    ...actual,
    getMerchantZohoEmailBrand: vi.fn(async () => ({
      brandColor: '#0f766e',
      brandName: 'Oga Gadgets',
    })),
  };
});

import { buildZohoBlogContentSignature } from '@/lib/zoho-blog-content-signing-server';
import { GET } from './route';

const postId = '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2';

function makeSignedContentUrl(id = postId): string {
  const signature = buildZohoBlogContentSignature({
    contentSecret: 'content-secret',
    postId: id,
  });
  return `https://ogabassey.com/api/integrations/zoho/blog-content/${id}?sig=${signature}`;
}

describe('GET /api/integrations/zoho/blog-content/[postId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: {
        category: 'Smartphones',
        content: '<p>Full body</p>',
        excerpt: 'Launch details',
        featured_image_alt: 'Hot 70',
        featured_image_url: 'https://cdn.ogabassey.com/hot70.jpg',
        id: postId,
        merchant_id: 'merchant-1',
        published_at: '2026-06-07T10:00:00.000Z',
        slug: 'infinix-hot-70-launch',
        status: 'published',
        title: 'Infinix Hot 70 launch',
      },
      error: null,
    });
  });

  it('returns 400 for invalid post ids', async () => {
    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/blog-content/nope'
      ),
      { params: Promise.resolve({ postId: 'nope' }) }
    );

    expect(response.status).toBe(400);
    expect(mockQuery.from).not.toHaveBeenCalled();
  });

  it('renders public email HTML for published posts only', async () => {
    const response = await GET(new Request(makeSignedContentUrl()), {
      params: Promise.resolve({ postId }),
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Infinix Hot 70 launch');
    expect(html).toContain(
      'https://usebaci.com/ogabassey/blog/infinix-hot-70-launch'
    );
    expect(html).toContain('Oga Gadgets Smartphones');
    expect(html).toContain('background:#0f766e');
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('sets short public cache headers for Zoho content imports', async () => {
    const response = await GET(new Request(makeSignedContentUrl()), {
      params: Promise.resolve({ postId }),
    });

    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=300'
    );
  });

  it('returns 500 when Supabase fails to load the post', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await GET(new Request(makeSignedContentUrl()), {
      params: Promise.resolve({ postId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load blog post',
    });
  });

  it('returns 404 when no published post is found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await GET(new Request(makeSignedContentUrl()), {
      params: Promise.resolve({ postId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Blog post not found',
    });
  });

  it('returns 404 when the post has no slug', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        category: 'Smartphones',
        content: '<p>Full body</p>',
        excerpt: 'Launch details',
        featured_image_alt: 'Hot 70',
        featured_image_url: 'https://cdn.ogabassey.com/hot70.jpg',
        id: postId,
        merchant_id: 'merchant-1',
        published_at: '2026-06-07T10:00:00.000Z',
        slug: null,
        status: 'published',
        title: 'Infinix Hot 70 launch',
      },
      error: null,
    });

    const response = await GET(new Request(makeSignedContentUrl()), {
      params: Promise.resolve({ postId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Blog post not found',
    });
  });

  it('returns 403 when the Zoho content signature is invalid', async () => {
    const response = await GET(
      new Request(
        `https://ogabassey.com/api/integrations/zoho/blog-content/${postId}?sig=bad`
      ),
      { params: Promise.resolve({ postId }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid Zoho content signature',
    });
    expect(mockQuery.from).not.toHaveBeenCalled();
  });
});
