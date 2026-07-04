import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInternalApiSecret = vi.fn();
const mockRevalidateProducts = vi.fn();
const mockScheduleStorefrontProductPurge = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
}));
vi.mock('@/lib/storefront-product-purge', () => ({
  scheduleStorefrontProductPurge: (...args: unknown[]) =>
    mockScheduleStorefrontProductPurge(...args),
}));

import { POST } from './route';

const SECRET = 'test-internal-secret';
const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

function request(body: unknown, authHeader?: string): NextRequest {
  return new NextRequest(
    'https://app.usebaci.com/api/internal/revalidate-products',
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

describe('POST /api/internal/revalidate-products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue(SECRET);
  });

  it('revalidates the merchant product caches for a valid authed request', async () => {
    const res = await POST(
      request({ merchantId: MERCHANT_ID }, `Bearer ${SECRET}`)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('does NOT schedule a purge for a merchantId-only body', async () => {
    await POST(request({ merchantId: MERCHANT_ID }, `Bearer ${SECRET}`));

    expect(mockScheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('schedules a purge when merchantSlug and products are present', async () => {
    const res = await POST(
      request(
        {
          merchantId: MERCHANT_ID,
          merchantSlug: 'ogabassey',
          products: [{ slug: 'iphone-15', category: 'Smartphones' }],
        },
        `Bearer ${SECRET}`
      )
    );

    expect(res.status).toBe(200);
    expect(mockRevalidateProducts).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'ogabassey',
      [{ slug: 'iphone-15', categorySegment: 'smartphones' }],
      { listingsOnly: false }
    );
  });

  it('returns 500 when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue(undefined);

    const res = await POST(
      request({ merchantId: MERCHANT_ID }, `Bearer ${SECRET}`)
    );

    expect(res.status).toBe(500);
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await POST(request({ merchantId: MERCHANT_ID }));

    expect(res.status).toBe(401);
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const res = await POST(
      request({ merchantId: MERCHANT_ID }, 'Bearer wrong')
    );

    expect(res.status).toBe(401);
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await POST(request('not-json{', `Bearer ${SECRET}`));

    expect(res.status).toBe(400);
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('returns 400 when merchantId is missing/blank', async () => {
    const res = await POST(request({ merchantId: '   ' }, `Bearer ${SECRET}`));

    expect(res.status).toBe(400);
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });
});
