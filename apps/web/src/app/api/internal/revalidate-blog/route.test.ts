import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInternalApiSecret = vi.fn();
const mockRevalidateBlogPosts = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateBlogPosts: (...args: unknown[]) => mockRevalidateBlogPosts(...args),
}));

import { POST } from './route';

const SECRET = 'test-internal-secret';

function request(body: unknown, authHeader?: string): NextRequest {
  return new NextRequest(
    'https://app.usebaci.com/api/internal/revalidate-blog',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );
}

describe('POST /api/internal/revalidate-blog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue(SECRET);
  });

  it('revalidates exact blog paths for a valid authed request', async () => {
    const res = await POST(
      request(
        {
          identifiers: ['ogabassey.com', 'ogabassey'],
          merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
          canonicalMerchantSlug: 'ogabassey',
          listingCategories: ['Smartphones'],
          listingPages: [1, 2],
          postSlugs: ['old-post', 'canonical-post'],
        },
        `Bearer ${SECRET}`
      )
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['ogabassey.com', 'ogabassey'],
      merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      canonicalMerchantSlug: 'ogabassey',
      listingCategories: ['Smartphones'],
      listingPages: [1, 2],
      postSlugs: ['old-post', 'canonical-post'],
    });
  });

  it('defaults optional listing inputs to safe blog-list values', async () => {
    const res = await POST(
      request(
        {
          identifiers: ['ogabassey.com'],
          postSlugs: ['old-post'],
        },
        `Bearer ${SECRET}`
      )
    );

    expect(res.status).toBe(200);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['ogabassey.com'],
      canonicalMerchantSlug: undefined,
      listingCategories: [],
      listingPages: [1],
      postSlugs: ['old-post'],
    });
  });

  it('returns 500 when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue(undefined);

    const res = await POST(
      request({ identifiers: ['ogabassey.com'], postSlugs: ['old-post'] })
    );

    expect(res.status).toBe(500);
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await POST(
      request({ identifiers: ['ogabassey.com'], postSlugs: ['old-post'] })
    );

    expect(res.status).toBe(401);
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const res = await POST(
      request(
        { identifiers: ['ogabassey.com'], postSlugs: ['old-post'] },
        'Bearer wrong'
      )
    );

    expect(res.status).toBe(401);
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await POST(request('not-json{', `Bearer ${SECRET}`));

    expect(res.status).toBe(400);
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid blog revalidation input', async () => {
    const res = await POST(
      request(
        { identifiers: ['ogabassey.com'], postSlugs: [] },
        `Bearer ${SECRET}`
      )
    );

    expect(res.status).toBe(400);
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });
});
