import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const mockCheckCsrfProtection = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

const mockGetMerchantBlogRevalidationContext = vi.fn();

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: (...args: unknown[]) =>
    mockGetMerchantBlogRevalidationContext(...args),
}));

const mockDispatchZohoBlogCampaign = vi.fn();

vi.mock('@/lib/zoho-blog-campaign-server', () => ({
  dispatchConfiguredZohoBlogCampaign: (...args: unknown[]) =>
    mockDispatchZohoBlogCampaign(...args),
}));

const createChainableMock = () => {
  const mock = {
    eq: vi.fn(),
    from: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };

  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);

  return mock;
};

const mockSupabase = createChainableMock();

import { POST } from './route';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const POST_ID = '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2';
const USER_ID = 'user-123';

const publishedPost = {
  category: 'smartphones',
  excerpt: 'Launch details',
  id: POST_ID,
  merchant_id: MERCHANT_ID,
  published_at: '2026-06-08T08:00:00.000Z',
  slug: 'infinix-hot-70-launch',
  status: 'published',
  title: 'Infinix Hot 70 released',
};

function makeRequest() {
  return new NextRequest(
    `http://localhost:3000/api/merchant/blog/posts/${POST_ID}/zoho-review-campaign`,
    { method: 'POST' }
  );
}

function makeParams(id = POST_ID) {
  return { params: Promise.resolve({ id }) };
}

function setupAuth(hasAuth = true, hasAccess = true) {
  if (hasAuth) {
    mockAuthenticateApiRequest.mockResolvedValue({
      supabase: mockSupabase,
      user: { id: USER_ID },
    });
  } else {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
  }

  mockGetUserAccess.mockResolvedValue(
    hasAccess ? { merchantId: MERCHANT_ID, role: 'owner' } : null
  );
}

describe('POST /api/merchant/blog/posts/[id]/zoho-review-campaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createChainableMock());
    setupAuth(true, true);
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockHasPermission.mockReturnValue(true);
    mockSupabase.maybeSingle.mockResolvedValue({
      data: publishedPost,
      error: null,
    });
    mockGetMerchantBlogRevalidationContext.mockResolvedValue({
      canonicalMerchantSlug: 'ogabassey',
      identifiers: ['ogabassey', 'ogabassey.com'],
    });
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      campaignKey: 'campaign-review',
      contentUrl:
        'https://ogabassey.com/api/integrations/zoho/blog-content/post',
      postId: POST_ID,
      status: 'sent',
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    setupAuth(false, false);

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: null,
      valid: false,
    });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 400 when the blog post id is invalid', async () => {
    const res = await POST(makeRequest(), makeParams('not-a-uuid'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid input');
    expect(json.details.fieldErrors.id).toContain('Invalid blog post id');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant access is missing', async () => {
    setupAuth(true, false);

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks marketing edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Permission denied');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 404 when the post is missing', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Post not found');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 500 when the post lookup fails', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to load blog post');
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('returns 409 when the post is not published', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { ...publishedPost, published_at: null, status: 'draft' },
      error: null,
    });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe(
      'Post must be published before sending a review campaign'
    );
    expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
  });

  it('sends a review campaign with the authenticated Supabase client', async () => {
    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.zohoCampaign).toMatchObject({
      campaignKey: 'campaign-review',
      status: 'sent',
    });
    expect(mockSupabase.select).toHaveBeenCalledWith(
      'id, title, slug, excerpt, category, merchant_id, status, published_at'
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', POST_ID);
    expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith({
      audience: 'review',
      context: {
        canonicalMerchantSlug: 'ogabassey',
        identifiers: ['ogabassey', 'ogabassey.com'],
      },
      post: publishedPost,
      supabase: mockSupabase,
    });
  });

  it('returns 502 when the review campaign dispatch fails', async () => {
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      error: 'Zoho send failed',
      postId: POST_ID,
      status: 'failed',
    });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.zohoCampaign).toEqual({
      error: 'Zoho send failed',
      postId: POST_ID,
      status: 'failed',
    });
  });

  it('returns 422 when dispatch is skipped because review config is missing', async () => {
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: POST_ID,
      reason: 'Missing Zoho Campaigns merchant settings: reviewListKey',
      status: 'skipped',
    });

    const res = await POST(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.zohoCampaign).toEqual({
      postId: POST_ID,
      reason: 'Missing Zoho Campaigns merchant settings: reviewListKey',
      status: 'skipped',
    });
  });
});
